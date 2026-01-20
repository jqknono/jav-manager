using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Services;
using JavManager.DataProviders.JavDb;
using JavManager.DataProviders.Everything;
using JavManager.DataProviders.QBittorrent;
using JavManager.Utils;
using JavManager.ConsoleUI;
using JavManager.Core.Models;
using Spectre.Console;

namespace JavManager;

class Program
{
    static bool IsValidJavId(string javId)
        => System.Text.RegularExpressions.Regex.IsMatch(
            javId,
            @"^[A-Z0-9]+-\d+$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    static async Task Main(string[] args)
    {
        try
        {
            // 测试 curl
            if (args.Length > 0 && args[0] == "--test-curl")
            {
                await TestCurl.RunTestAsync();
                return;
            }

            // 解析命令行参数
            var subCommand = args.Length > 0 ? args[0].Trim() : string.Empty;
            if (subCommand.Equals("help", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("h", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("--help", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("-h", StringComparison.OrdinalIgnoreCase))
            {
                ShowHelp();
                return;
            }

            // 构建配置
            var config = BuildConfiguration();

            // 创建主机
            var host = CreateHostBuilder(config).Build();

            // 初始化服务
            var services = host.Services;
            var displayService = services.GetRequiredService<DisplayService>();
            var inputHandler = services.GetRequiredService<UserInputHandler>();
            var javSearchService = services.GetRequiredService<JavSearchService>();
            var healthCheckService = services.GetRequiredService<HealthCheckService>();
            var nameParser = services.GetRequiredService<TorrentNameParser>();
            var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
            var torrentSelectionService = services.GetRequiredService<TorrentSelectionService>();

            if (args.Length > 0 &&
                await TryExecuteSubCommandAsync(
                    args,
                    services,
                    displayService,
                    inputHandler,
                    javSearchService,
                    healthCheckService,
                    nameParser,
                    autoConfirmSearch: true))
            {
                return;
            }

            var javId = ParseCommandLineArgs(args);

            // 如果没有提供番号参数，显示欢迎信息
            if (string.IsNullOrEmpty(javId))
            {
                displayService.ShowWelcome();
            }

            // 执行健康检查
            if (string.IsNullOrEmpty(javId))
            {
                await displayService.ShowLoadingAsync("正在检查服务状态...", async () =>
                {
                    await Task.Delay(100);
                });
            }
            var healthResults = await healthCheckService.CheckAllAsync();
            if (string.IsNullOrEmpty(javId))
            {
                displayService.ShowHealthCheckResults(healthResults);
            }
            else
            {
                // 非交互模式：如果服务不健康，仍然显示错误但继续
                var unhealthyServices = healthResults.Where(r => !r.IsHealthy).ToList();
                if (unhealthyServices.Any())
                {
                    foreach (var service in unhealthyServices)
                    {
                        AnsiConsole.MarkupLine($"[yellow]警告: {Markup.Escape(service.ServiceName)} - {Markup.Escape(service.Message)}[/]");
                    }

                    displayService.ShowDependencySetupHints(unhealthyServices);
                }
            }

            // 如果提供了番号参数，直接处理（非交互模式）
            if (!string.IsNullOrEmpty(javId))
            {
                await ProcessJavIdAsync(
                    javId,
                    displayService,
                    inputHandler,
                    javSearchService,
                    javDbProvider,
                    torrentSelectionService,
                    nameParser,
                    autoConfirm: true);
                return;
            }

            // 主循环（交互模式）
            await RunMainLoopAsync(displayService, inputHandler, javSearchService, healthCheckService, nameParser, services);
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]错误: {Markup.Escape(ex.Message)}[/]");
            Environment.ExitCode = 1;
        }
    }

    /// <summary>
    /// 解析命令行参数
    /// </summary>
    static void ShowHelp()
    {
        Console.WriteLine("JavManager - 命令:");
        Console.WriteLine("  <番号>        默认搜索并下载（等同于 s <番号>）");
        Console.WriteLine("  s <番号>      搜索并下载");
        Console.WriteLine("  r <番号>      远端搜索（JavDB）");
        Console.WriteLine("  l <番号>      本地搜索（Everything，默认只显示 >=100MB，可用 -m 200MB）");
        Console.WriteLine("  d             正在下载列表（qBittorrent）");
        Console.WriteLine("  t             下载任务列表（qBittorrent）");
        Console.WriteLine("  h             显示帮助");
        Console.WriteLine("  q             退出（交互模式）");
        Console.WriteLine("  --test-curl    运行 curl 测试");
    }

    static List<string> SplitArgs(string commandLine)
    {
        var args = new List<string>();
        if (string.IsNullOrWhiteSpace(commandLine))
            return args;

        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < commandLine.Length; i++)
        {
            var ch = commandLine[i];
            if (ch == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes && char.IsWhiteSpace(ch))
            {
                if (current.Length > 0)
                {
                    args.Add(current.ToString());
                    current.Clear();
                }
                continue;
            }

            current.Append(ch);
        }

        if (current.Length > 0)
            args.Add(current.ToString());

        return args;
    }

    static async Task<bool> TryExecuteSubCommandAsync(
        string[] args,
        IServiceProvider services,
        DisplayService displayService,
        UserInputHandler inputHandler,
        JavSearchService javSearchService,
        HealthCheckService healthCheckService,
        TorrentNameParser nameParser,
        bool autoConfirmSearch)
    {
        if (args.Length == 0)
            return false;

        var cmd = args[0].Trim();

        if (cmd.Equals("help", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("h", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("--help", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("-h", StringComparison.OrdinalIgnoreCase))
        {
            ShowHelp();
            return true;
        }

        if (cmd.Equals("l", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("local", StringComparison.OrdinalIgnoreCase))
        {
            if (args.Length < 2)
            {
                displayService.ShowError("用法: l <番号> [-m 100MB]");
                return true;
            }

            var minBytes = SizeParser.MB(100);
            var queryParts = new List<string>();
            for (var i = 1; i < args.Length; i++)
            {
                var token = args[i];
                if (token.Equals("--min-size", StringComparison.OrdinalIgnoreCase) ||
                    token.Equals("--min", StringComparison.OrdinalIgnoreCase) ||
                    token.Equals("-m", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 >= args.Length || !SizeParser.TryParseToBytes(args[i + 1], out minBytes))
                    {
                        displayService.ShowError("用法: l <番号> [-m 100MB]");
                        return true;
                    }

                    i++;
                    continue;
                }

                queryParts.Add(token);
            }

            if (queryParts.Count == 0)
            {
                displayService.ShowError("用法: l <番号> [-m 100MB]");
                return true;
            }

            var query = string.Join(" ", queryParts);
            var normalizedId = nameParser.NormalizeJavId(query);

            var healthResultsForLocal = await healthCheckService.CheckAllAsync();
            var everythingHealth = healthResultsForLocal.FirstOrDefault(r => r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase));
            if (everythingHealth != null && !everythingHealth.IsHealthy)
            {
                displayService.ShowHealthCheckResults(healthResultsForLocal);
                return true;
            }

            var searchProvider = services.GetRequiredService<IEverythingSearchProvider>();
            var results = await searchProvider.SearchAsync(normalizedId);
            var filtered = results.Where(f => f.Size >= minBytes).ToList();
            if (filtered.Count == 0)
            {
                displayService.ShowInfo($"未找到大小超过 {minBytes / 1024d / 1024d:0.##} MB 的本地文件。");
                return true;
            }

            displayService.ShowLocalFileInfo(filtered);
            return true;
        }

        if (cmd.Equals("r", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("remote", StringComparison.OrdinalIgnoreCase))
        {
            if (args.Length < 2)
            {
                displayService.ShowError("用法: r <番号>");
                return true;
            }

            var javIdForQuery = nameParser.NormalizeJavId(string.Join(" ", args.Skip(1)));
            if (!IsValidJavId(javIdForQuery))
            {
                displayService.ShowError($"\"{javIdForQuery}\"不是一个合法的番号名, 番号名必须是<字母数个>-<数字数个>的形式.");
                return true;
            }

            var healthResultsForRemote = await healthCheckService.CheckAllAsync();
            var javDbHealth = healthResultsForRemote.FirstOrDefault(r => r.ServiceName.Contains("JavDB", StringComparison.OrdinalIgnoreCase));
            if (javDbHealth != null && !javDbHealth.IsHealthy)
            {
                displayService.ShowHealthCheckResults(healthResultsForRemote);
                return true;
            }

            var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
            var candidates = await javDbProvider.SearchCandidatesAsync(javIdForQuery);
            if (candidates.Count == 0)
            {
                displayService.ShowInfo($"未找到 {javIdForQuery} 的搜索结果。");
                return true;
            }

            var selectedCandidate = SelectJavDbCandidate(candidates, javIdForQuery, inputHandler, displayService, nameParser, autoConfirmSearch);
            if (selectedCandidate == null)
            {
                displayService.ShowInfo("已取消。");
                return true;
            }

            var detail = await javDbProvider.GetDetailAsync(selectedCandidate.DetailUrl);
            var selectionService = services.GetRequiredService<TorrentSelectionService>();
            var sorted = selectionService.GetSortedTorrents(detail.Torrents);
            displayService.ShowSearchResults(sorted);
            return true;
        }

        if (cmd.Equals("d", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("downloading", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("t", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("downloads", StringComparison.OrdinalIgnoreCase))
        {
            var healthResultsForDownloads = await healthCheckService.CheckAllAsync();
            var qbHealth = healthResultsForDownloads.FirstOrDefault(r => r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase));
            if (qbHealth != null && !qbHealth.IsHealthy)
            {
                displayService.ShowHealthCheckResults(healthResultsForDownloads);
                return true;
            }

            var dlService = services.GetRequiredService<DownloadService>();
            var torrents = await dlService.GetDownloadsAsync();
            var list = torrents;

            var downloadingOnly =
                cmd.Equals("d", StringComparison.OrdinalIgnoreCase) ||
                cmd.Equals("downloading", StringComparison.OrdinalIgnoreCase);
            if (downloadingOnly)
            {
                list = torrents
                    .Where(t =>
                        !string.IsNullOrWhiteSpace(t.State) &&
                        (t.State.Contains("downloading", StringComparison.OrdinalIgnoreCase) ||
                         t.State.Contains("stalleddl", StringComparison.OrdinalIgnoreCase) ||
                         t.State.Contains("metadl", StringComparison.OrdinalIgnoreCase)))
                    .ToList();
            }

            displayService.ShowDownloadList(list);
            return true;
        }

        if (cmd.Equals("s", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("search", StringComparison.OrdinalIgnoreCase))
        {
            if (args.Length < 2)
            {
                displayService.ShowError("用法: s <番号>");
                return true;
            }

            var query = string.Join(" ", args.Skip(1));
            var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
            var torrentSelectionService = services.GetRequiredService<TorrentSelectionService>();
            await ProcessJavIdAsync(
                query,
                displayService,
                inputHandler,
                javSearchService,
                javDbProvider,
                torrentSelectionService,
                nameParser,
                autoConfirm: autoConfirmSearch);
            return true;
        }

        return false;
    }

    static string? ParseCommandLineArgs(string[] args)
    {
        if (args.Length == 0) return null;

        // 支持 --id <番号> 或直接传入番号
        if (args.Length >= 2 && args[0].Equals("--id", StringComparison.OrdinalIgnoreCase))
        {
            return args[1];
        }

        // 支持直接传入番号作为第一个参数
        return args[0];
    }

    /// <summary>
    /// 构建配置
    /// </summary>
    static IConfiguration BuildConfiguration()
    {
        var basePath = Path.Combine(AppContext.BaseDirectory);
        return new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables(prefix: "JAVMANAGER_")
            .Build();
    }

    /// <summary>
    /// 创建主机构建器
    /// </summary>
    static IHostBuilder CreateHostBuilder(IConfiguration configuration)
    {
        return Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                // 注册配置（IOptions 模式）
                services.Configure<EverythingConfig>(configuration.GetSection("Everything"));
                services.Configure<QBittorrentConfig>(configuration.GetSection("QBittorrent"));
                services.Configure<JavDbConfig>(configuration.GetSection("JavDb"));
                services.Configure<DownloadConfig>(configuration.GetSection("Download"));

                // 注册配置对象（直接注入）
                var everythingConfig = configuration.GetSection("Everything").Get<EverythingConfig>() ?? new EverythingConfig();
                var qbittorrentConfig = configuration.GetSection("QBittorrent").Get<QBittorrentConfig>() ?? new QBittorrentConfig();
                var javDbConfig = configuration.GetSection("JavDb").Get<JavDbConfig>() ?? new JavDbConfig();
                var downloadConfig = configuration.GetSection("Download").Get<DownloadConfig>() ?? new DownloadConfig();

                services.AddSingleton(everythingConfig);
                services.AddSingleton(qbittorrentConfig);
                services.AddSingleton(javDbConfig);
                services.AddSingleton(downloadConfig);

                // 注册工具类
                services.AddSingleton<TorrentNameParser>();
                services.AddSingleton<WeightCalculator>();

                // 注册数据提供者
                services.AddSingleton<IEverythingSearchProvider, EverythingHttpClient>();
                services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IEverythingSearchProvider>());
                services.AddSingleton<IQBittorrentClient, QBittorrentApiClient>();
                services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IQBittorrentClient>());
                services.AddSingleton<IJavDbDataProvider, JavDbWebScraper>();
                services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IJavDbDataProvider>());

                // 注册服务
                services.AddScoped<HealthCheckService>();
                services.AddScoped<TorrentSelectionService>();
                services.AddScoped<LocalFileCheckService>();
                services.AddScoped<DownloadService>();
                services.AddScoped<JavSearchService>();

                // 注册 UI
                services.AddScoped<UserInputHandler>();
                services.AddScoped<DisplayService>();
            });
    }

    /// <summary>
    /// 主循环
    /// </summary>
    static async Task RunMainLoopAsync(
        DisplayService displayService,
        UserInputHandler inputHandler,
        JavSearchService javSearchService,
        HealthCheckService healthCheckService,
        TorrentNameParser nameParser,
        IServiceProvider services)
    {
        while (true)
        {
            try
            {
                AnsiConsole.WriteLine();
                var input = inputHandler.GetJavId();

                // 退出命令
                if (input.Equals("quit", StringComparison.OrdinalIgnoreCase))
                {
                    displayService.ShowInfo("再见！");
                    break;
                }

                if (string.IsNullOrWhiteSpace(input))
                    continue;

                var cmdArgs = SplitArgs(input).ToArray();
                if (cmdArgs.Length > 0 &&
                    await TryExecuteSubCommandAsync(
                        cmdArgs,
                        services,
                        displayService,
                        inputHandler,
                        javSearchService,
                        healthCheckService,
                        nameParser,
                        autoConfirmSearch: false))
                {
                    continue;
                }

                // 处理搜索和下载（默认子命令）
                var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
                var torrentSelectionService = services.GetRequiredService<TorrentSelectionService>();
                await ProcessJavIdAsync(
                    input,
                    displayService,
                    inputHandler,
                    javSearchService,
                    javDbProvider,
                    torrentSelectionService,
                    nameParser);
            }
            catch (Exception ex)
            {
                displayService.ShowError($"发生错误: {ex.Message}");
                AnsiConsole.WriteLine();
                inputHandler.Pause();
            }
        }
    }

    /// <summary>
    /// 处理番号
    /// </summary>
    static async Task ProcessJavIdAsync(
        string javId,
        DisplayService displayService,
        UserInputHandler inputHandler,
        JavSearchService javSearchService,
        IJavDbDataProvider javDbProvider,
        TorrentSelectionService torrentSelectionService,
        TorrentNameParser nameParser,
        bool autoConfirm = false)
    {
        var normalizedJavId = nameParser.NormalizeJavId(javId);
        if (!IsValidJavId(normalizedJavId))
        {
            displayService.ShowError($"\"{normalizedJavId}\"不是一个合法的番号名, 番号名必须是<字母数个>-<数字数个>的形式.");
            return;
        }

        javId = normalizedJavId;

        // 搜索
        await displayService.ShowLoadingAsync($"正在搜索 {javId}...", async () =>
        {
            await Task.Delay(100); // 短暂延迟以显示动画
        });

        var candidates = await javDbProvider.SearchCandidatesAsync(javId);
        if (candidates.Count == 0)
        {
            displayService.ShowError($"未找到 {javId} 的搜索结果。");
            return;
        }

        var selectedCandidate = SelectJavDbCandidate(candidates, javId, inputHandler, displayService, nameParser, autoConfirm);
        if (selectedCandidate == null)
        {
            displayService.ShowInfo("已取消。");
            return;
        }

        var detail = await javDbProvider.GetDetailAsync(selectedCandidate.DetailUrl);
        var sortedTorrents = torrentSelectionService.GetSortedTorrents(detail.Torrents);
        if (sortedTorrents.Count == 0)
        {
            displayService.ShowError($"未找到 {javId} 的种子。");
            return;
        }

        // 显示搜索结果（种子列表）
        displayService.ShowSearchResults(sortedTorrents);

        // 询问是否继续下载（非交互模式下自动确认）
        AnsiConsole.WriteLine();
        var selectedIndex = autoConfirm ? 1 : inputHandler.GetTorrentIndexSelection(sortedTorrents.Count);
        if (selectedIndex == null)
        {
            displayService.ShowInfo("已取消。");
            return;
        }

        var selectedTorrent = sortedTorrents[selectedIndex.Value - 1];

        // 处理下载流程
        await ProcessDownloadAsync(javId, selectedTorrent, displayService, inputHandler, javSearchService, autoConfirm);
    }

    static JavSearchResult? SelectJavDbCandidate(
        List<JavSearchResult> candidates,
        string query,
        UserInputHandler inputHandler,
        DisplayService displayService,
        TorrentNameParser nameParser,
        bool autoConfirm)
    {
        if (candidates.Count == 0)
            return null;

        if (autoConfirm || candidates.Count == 1)
            return ChooseBestCandidate(candidates, query, nameParser);

        displayService.ShowJavDbCandidates(candidates);
        AnsiConsole.WriteLine();
        var idx = inputHandler.GetSearchResultIndexSelection(candidates.Count);
        if (idx == null)
            return null;

        return candidates[idx.Value - 1];
    }

    static JavSearchResult ChooseBestCandidate(List<JavSearchResult> candidates, string query, TorrentNameParser nameParser)
    {
        if (candidates.Count == 1)
            return candidates[0];

        var normalizedQuery = nameParser.NormalizeJavId(query);

        foreach (var c in candidates)
        {
            var id = nameParser.NormalizeJavId(string.IsNullOrWhiteSpace(c.JavId) ? c.Title : c.JavId);
            if (IsValidJavId(id) && id.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase))
                return c;

            var idFromTitle = nameParser.NormalizeJavId(c.Title);
            if (IsValidJavId(idFromTitle) && idFromTitle.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase))
                return c;
        }

        var match = candidates.FirstOrDefault(c =>
            !string.IsNullOrWhiteSpace(c.Title) &&
            c.Title.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase));
        return match ?? candidates[0];
    }

    /// <summary>
    /// 处理下载流程
    /// </summary>
    static async Task ProcessDownloadAsync(
        string javId,
        TorrentInfo selectedTorrent,
        DisplayService displayService,
        UserInputHandler inputHandler,
        JavSearchService javSearchService,
        bool autoConfirm = false)
    {
        var result = await javSearchService.ProcessSelectedTorrentAsync(javId, selectedTorrent);

        displayService.ShowProcessResult(result);

        // 如果本地文件存在，处理用户选择
        if (result.LocalFilesFound)
        {
            // 非交互模式下，自动跳过已存在的文件
            if (autoConfirm)
            {
                displayService.ShowInfo("本地已存在文件，跳过下载。");
                return;
            }

            var selection = inputHandler.GetLocalFileSelection(result.LocalFiles);

            if (selection.IsCancelled)
            {
                displayService.ShowInfo("已跳过下载。");
                return;
            }

            if (selection.ForceDownload)
            {
                displayService.ShowInfo("正在强制下载...");
                var forceResult = await javSearchService.ProcessSelectedTorrentAsync(javId, selectedTorrent, forceDownload: true);
                displayService.ShowProcessResult(forceResult);
            }
            else if (selection.SelectedIndex == 3)
            {
                // 显示文件详情
                displayService.ShowLocalFileInfo(result.LocalFiles);
                inputHandler.Pause();
            }
        }
    }
}

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Services;
using JavManager.DataProviders.JavDb;
using JavManager.DataProviders.Everything;
using JavManager.DataProviders.QBittorrent;
using JavManager.DataProviders.LocalCache;
using JavManager.Utils;
using JavManager.ConsoleUI;
using JavManager.Core.Models;
using JavManager.Localization;
using JavManager.Gui;
using JavManager.Gui.Localization;
using JavManager.Gui.Services;
using JavManager.Gui.ViewModels;
using Spectre.Console;

namespace JavManager;

class Program
{
    private static LocalizationService? _loc;
    private static TelemetryService? _telemetry;

    static bool IsValidJavId(string javId)
        => System.Text.RegularExpressions.Regex.IsMatch(
            javId,
            @"^[A-Z0-9]+-\d+$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    static void ConfigureConsoleEncoding()
    {
        try
        {
            var utf8 = new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
            Console.InputEncoding = utf8;
            Console.OutputEncoding = utf8;
        }
        catch
        {
            // ignore: some hosts may not allow changing console encodings
        }
    }

    static void ShowUnhealthyServiceWarnings(DisplayService displayService, List<HealthCheckResult> healthResults, Func<HealthCheckResult, bool>? filter = null)
    {
        var unhealthyServices = healthResults
            .Where(r => !r.IsHealthy && (filter == null || filter(r)))
            .ToList();
        if (unhealthyServices.Count == 0)
            return;

        foreach (var service in unhealthyServices)
        {
            AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc!.Get(L.Warning))}: {Markup.Escape(service.ServiceName)} - {Markup.Escape(service.Message)}[/]");
        }

        displayService.ShowDependencySetupHints(unhealthyServices);
    }

    static bool ShouldRunGui(string[] args)
    {
        // Check for --no-gui flag
        foreach (var arg in args)
        {
            if (arg.Equals("--no-gui", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("--console", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("-c", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        // CLI-only flags should always run in console mode
        foreach (var arg in args)
        {
            if (arg.Equals("help", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("h", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("--help", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("-h", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("version", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("v", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("--version", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("-v", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("--test-curl", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        // If any arguments are provided (JAV ID, commands, etc.), run in console mode
        if (args.Length > 0)
        {
            var first = args[0].Trim();
            // Check if it's a known command or looks like a JAV ID
            if (!first.StartsWith("--") &&
                !first.Equals("gui", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        // Default to GUI
        return true;
    }

    static string[] FilterGuiArgs(string[] args)
    {
        return args.Where(a =>
            !a.Equals("--no-gui", StringComparison.OrdinalIgnoreCase) &&
            !a.Equals("--console", StringComparison.OrdinalIgnoreCase) &&
            !a.Equals("-c", StringComparison.OrdinalIgnoreCase) &&
            !a.Equals("gui", StringComparison.OrdinalIgnoreCase)).ToArray();
    }

    [STAThread]
    static async Task Main(string[] args)
    {
        try
        {
            // Check if we should run in GUI mode
            var runGui = ShouldRunGui(args);
            args = FilterGuiArgs(args);

            // NOTE: This app is built as WinExe (GUI subsystem). When running in console mode,
            // explicitly attach/allocate a console so stdout/stderr are visible.
            if (!runGui)
            {
                ConsoleHost.EnsureConsole();
            }

            ConfigureConsoleEncoding();

            // 解析全局命令行配置覆盖（尽早解析，以支持语言/遥测等配置）
            var (configOverrides, effectiveArgs) = ExtractConfigurationOverrides(args);

            // 构建配置（尽早构建，以支持语言/遥测等配置）
            var config = BuildConfiguration(configOverrides);

            // 初始化本地化服务（尽早初始化以支持命令行帮助显示）
            _loc = new LocalizationService(config);

            // 初始化遥测服务（尽早初始化以捕获启动事件）
            var telemetryConfig = config.GetSection("Telemetry").Get<TelemetryConfig>() ?? new TelemetryConfig();
            _telemetry = new TelemetryService(telemetryConfig.Endpoint, telemetryConfig.Enabled);
            AppDomain.CurrentDomain.ProcessExit += (_, _) => _telemetry?.Dispose();
            _telemetry.TrackStartup();

            // GUI mode
            if (runGui)
            {
                var guiHost = CreateHostBuilder(config, _loc, includeGuiServices: true).Build();
                var guiServices = guiHost.Services;

                // Initialize cache
                var guiCacheProvider = guiServices.GetService<IJavLocalCacheProvider>();
                if (guiCacheProvider != null)
                {
                    await guiCacheProvider.InitializeAsync();
                }

                // Run GUI
                GuiStartup.Run(guiServices);
                return;
            }

            // Console mode below
            // 测试 curl
            if (effectiveArgs.Length > 0 && effectiveArgs[0] == "--test-curl")
            {
                await TestCurl.RunTestAsync(config, _loc);
                return;
            }

            // 解析命令行参数
            var subCommand = effectiveArgs.Length > 0 ? effectiveArgs[0].Trim() : string.Empty;
            if (subCommand.Equals("version", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("v", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("--version", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("-v", StringComparison.OrdinalIgnoreCase))
            {
                AnsiConsole.MarkupLine($"[blue]{Markup.Escape(AppInfo.Name)}[/] [green]{Markup.Escape(AppInfo.Version)}[/]");
                return;
            }
            if (subCommand.Equals("help", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("h", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("--help", StringComparison.OrdinalIgnoreCase) ||
                subCommand.Equals("-h", StringComparison.OrdinalIgnoreCase))
            {
                ShowHelp();
                return;
            }

            // 创建主机
            var host = CreateHostBuilder(config, _loc, includeGuiServices: false).Build();

            // 初始化服务
            var services = host.Services;
            var displayService = services.GetRequiredService<DisplayService>();
            var inputHandler = services.GetRequiredService<UserInputHandler>();
            var javSearchService = services.GetRequiredService<JavSearchService>();
            var healthCheckService = services.GetRequiredService<HealthCheckService>();
            var serviceAvailability = services.GetRequiredService<ServiceAvailability>();
            var nameParser = services.GetRequiredService<TorrentNameParser>();
            var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
            var torrentSelectionService = services.GetRequiredService<TorrentSelectionService>();

            // 初始化本地缓存数据库
            var cacheProvider = services.GetService<IJavLocalCacheProvider>();
            if (cacheProvider != null)
            {
                await cacheProvider.InitializeAsync();
            }

            if (effectiveArgs.Length > 0 &&
                await TryExecuteSubCommandAsync(
                    effectiveArgs,
                    services,
                    displayService,
                    inputHandler,
                    javSearchService,
                    healthCheckService,
                    serviceAvailability,
                    nameParser,
                    autoConfirmSearch: true))
            {
                return;
            }

            var javId = ParseCommandLineArgs(effectiveArgs);
            var startupHealthCheckTask = healthCheckService.CheckAllAsync();
            _ = startupHealthCheckTask.ContinueWith(
                t =>
                {
                    if (t.Status == TaskStatus.RanToCompletion)
                    {
                        serviceAvailability.UpdateFrom(t.Result);
                    }
                },
                TaskScheduler.Default);

            // 如果没有提供番号参数，显示欢迎信息
            if (string.IsNullOrEmpty(javId))
            {
                displayService.ShowWelcome();
                displayService.ShowInfo(_loc.Get(L.HealthCheckStarted));
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
                    serviceAvailability,
                    services.GetRequiredService<IJavInfoTelemetryClient>(),
                    cacheProvider: cacheProvider,
                    autoConfirm: true);

                if (startupHealthCheckTask.IsCompletedSuccessfully)
                {
                    ShowUnhealthyServiceWarnings(displayService, startupHealthCheckTask.Result);
                }
                return;
            }

            // 主循环（交互模式）
            await RunMainLoopAsync(
                displayService,
                inputHandler,
                javSearchService,
                healthCheckService,
                serviceAvailability,
                nameParser,
                services,
                startupHealthCheckTask);
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc?.Get(L.Error) ?? "Error")}: {Markup.Escape(ex.Message)}[/]");
            Environment.ExitCode = 1;
        }
    }

    /// <summary>
    /// Show help information
    /// </summary>
    static void ShowHelp()
    {
        AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc!.GetFormat(L.HelpTitle, AppInfo.Name, AppInfo.Version))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdSearchDownload))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdLocalSearch))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdRemoteSearch))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdCacheStats))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdDownloading))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdDownloads))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdHealthCheck))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdVersion))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdHelp))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdLang))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdConfig))}[/]");
        AnsiConsole.MarkupLine($"  [cyan]{Markup.Escape(_loc.Get(L.CmdQuit))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.CmdTestCurl))}[/]");
        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.HelpOptionsTitle))}[/]");
        AnsiConsole.MarkupLine($"  [grey]--no-gui, -c           Run in console mode (default: GUI)[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptLanguage))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptJavDbUrl))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptEverythingUrl))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptEverythingUser))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptEverythingPass))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptQBittorrentUrl))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptQBittorrentUser))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.OptQBittorrentPass))}[/]");
    }

    static string MaskSecret(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "-";
        if (value.Length <= 2)
            return "**";
        return new string('*', Math.Min(value.Length, 8));
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
        ServiceAvailability serviceAvailability,
        TorrentNameParser nameParser,
        bool autoConfirmSearch,
        List<HealthCheckResult>? healthResultsForInput = null)
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

        if (cmd.Equals("version", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("v", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("--version", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("-v", StringComparison.OrdinalIgnoreCase))
        {
            displayService.ShowInfo($"{AppInfo.Name} {AppInfo.Version}");
            return true;
        }

        if (cmd.Equals("lang", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("language", StringComparison.OrdinalIgnoreCase))
        {
            if (args.Length < 2)
            {
                displayService.ShowError(_loc!.Get(L.UsageLang));
                return true;
            }

            _loc!.SetLanguage(args[1]);
            displayService.ShowSuccess(_loc.GetFormat(L.LangSwitched, _loc.CurrentCulture.TwoLetterISOLanguageName));
            return true;
        }

        if (cmd.Equals("cfg", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("config", StringComparison.OrdinalIgnoreCase))
        {
            if (args.Length < 2)
            {
                displayService.ShowError(_loc!.Get(L.UsageConfig));
                return true;
            }

            var action = args[1].Trim();
            if (action.Equals("show", StringComparison.OrdinalIgnoreCase))
            {
                var everythingConfig = services.GetRequiredService<EverythingConfig>();
                var qbConfig = services.GetRequiredService<QBittorrentConfig>();
                var javDbConfig = services.GetRequiredService<JavDbConfig>();

                displayService.ShowInfo($"Everything.BaseUrl: {everythingConfig.BaseUrl}");
                displayService.ShowInfo($"Everything.UserName: {everythingConfig.UserName ?? "-"}");
                displayService.ShowInfo($"Everything.Password: {MaskSecret(everythingConfig.Password)}");

                displayService.ShowInfo($"QBittorrent.BaseUrl: {qbConfig.BaseUrl}");
                displayService.ShowInfo($"QBittorrent.UserName: {qbConfig.UserName}");
                displayService.ShowInfo($"QBittorrent.Password: {MaskSecret(qbConfig.Password)}");

                displayService.ShowInfo($"JavDb.BaseUrl: {javDbConfig.BaseUrl}");
                return true;
            }

            if (args.Length < 4)
            {
                displayService.ShowError(_loc!.Get(L.UsageConfig));
                return true;
            }

            var service = args[1].Trim();
            var key = args[2].Trim();
            var value = string.Join(" ", args.Skip(3)).Trim();

            if (string.IsNullOrWhiteSpace(value))
            {
                displayService.ShowError(_loc!.Get(L.UsageConfig));
                return true;
            }

            if (service.Equals("everything", StringComparison.OrdinalIgnoreCase) ||
                service.Equals("ev", StringComparison.OrdinalIgnoreCase))
            {
                var everythingConfig = services.GetRequiredService<EverythingConfig>();
                if (key.Equals("url", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("baseurl", StringComparison.OrdinalIgnoreCase))
                    everythingConfig.BaseUrl = value;
                else if (key.Equals("user", StringComparison.OrdinalIgnoreCase) ||
                         key.Equals("username", StringComparison.OrdinalIgnoreCase))
                    everythingConfig.UserName = value;
                else if (key.Equals("pass", StringComparison.OrdinalIgnoreCase) ||
                         key.Equals("password", StringComparison.OrdinalIgnoreCase))
                    everythingConfig.Password = value;
                else
                {
                    displayService.ShowError(_loc!.Get(L.UsageConfig));
                    return true;
                }

                displayService.ShowSuccess(_loc!.Get(L.ConfigUpdated));
                return true;
            }

            if (service.Equals("qb", StringComparison.OrdinalIgnoreCase) ||
                service.Equals("qbittorrent", StringComparison.OrdinalIgnoreCase))
            {
                var qbConfig = services.GetRequiredService<QBittorrentConfig>();
                if (key.Equals("url", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("baseurl", StringComparison.OrdinalIgnoreCase))
                    qbConfig.BaseUrl = value;
                else if (key.Equals("user", StringComparison.OrdinalIgnoreCase) ||
                         key.Equals("username", StringComparison.OrdinalIgnoreCase))
                    qbConfig.UserName = value;
                else if (key.Equals("pass", StringComparison.OrdinalIgnoreCase) ||
                         key.Equals("password", StringComparison.OrdinalIgnoreCase))
                    qbConfig.Password = value;
                else
                {
                    displayService.ShowError(_loc!.Get(L.UsageConfig));
                    return true;
                }

                displayService.ShowSuccess(_loc!.Get(L.ConfigUpdated));
                return true;
            }

            if (service.Equals("javdb", StringComparison.OrdinalIgnoreCase))
            {
                var javDbConfig = services.GetRequiredService<JavDbConfig>();
                if (key.Equals("url", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("baseurl", StringComparison.OrdinalIgnoreCase))
                {
                    javDbConfig.BaseUrl = value;
                    displayService.ShowSuccess(_loc!.Get(L.ConfigUpdated));
                    return true;
                }

                displayService.ShowError(_loc!.Get(L.UsageConfig));
                return true;
            }

            displayService.ShowError(_loc!.Get(L.UsageConfig));
            return true;
        }

        if (cmd.Equals("hc", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("health", StringComparison.OrdinalIgnoreCase))
        {
            var healthResults = healthResultsForInput ?? await healthCheckService.CheckAllAsync();
            serviceAvailability.UpdateFrom(healthResults);
            displayService.ShowHealthCheckResults(healthResults);
            return true;
        }

        if (cmd.Equals("l", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("local", StringComparison.OrdinalIgnoreCase))
        {
            if (args.Length < 2)
            {
                displayService.ShowError(_loc!.Get(L.UsageLocalSearch));
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
                        displayService.ShowError(_loc!.Get(L.UsageLocalSearch));
                        return true;
                    }

                    i++;
                    continue;
                }

                queryParts.Add(token);
            }

            if (queryParts.Count == 0)
            {
                displayService.ShowError(_loc!.Get(L.UsageLocalSearch));
                return true;
            }

            var query = string.Join(" ", queryParts);
            var normalizedId = nameParser.NormalizeJavId(query);

            var healthResultsForLocal = healthResultsForInput ?? await healthCheckService.CheckAllAsync();
            serviceAvailability.UpdateFrom(healthResultsForLocal);
            ShowUnhealthyServiceWarnings(
                displayService,
                healthResultsForLocal,
                r => r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase));
            if (!serviceAvailability.LocalDedupAvailable)
            {
                displayService.ShowError(_loc!.Get(L.EverythingUnavailable));
                return true;
            }

            var searchProvider = services.GetRequiredService<IEverythingSearchProvider>();
            var results = await searchProvider.SearchAsync(normalizedId);
            var filtered = results.Where(f => f.Size >= minBytes).ToList();
            if (filtered.Count == 0)
            {
                displayService.ShowInfo(_loc!.GetFormat(L.NoFilesOverSize, minBytes / 1024d / 1024d));
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
                displayService.ShowError(_loc!.Get(L.UsageRemoteSearch));
                return true;
            }

            var javIdForQuery = nameParser.NormalizeJavId(string.Join(" ", args.Skip(1)));
            if (!IsValidJavId(javIdForQuery))
            {
                displayService.ShowError(_loc!.GetFormat(L.InvalidJavId, javIdForQuery));
                return true;
            }

            var healthResultsForRemote = healthResultsForInput ?? await healthCheckService.CheckAllAsync();
            serviceAvailability.UpdateFrom(healthResultsForRemote);
            ShowUnhealthyServiceWarnings(
                displayService,
                healthResultsForRemote,
                r => r.ServiceName.Contains("JavDB", StringComparison.OrdinalIgnoreCase));
            if (!serviceAvailability.RemoteSearchAvailable)
            {
                displayService.ShowError(_loc!.Get(L.JavDbUnavailable));
                return true;
            }

            var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
            var candidates = await javDbProvider.SearchCandidatesAsync(javIdForQuery);
            if (candidates.Count == 0)
            {
                displayService.ShowInfo($"{_loc!.Get(L.NoSearchResults)}: {javIdForQuery}");
                return true;
            }

            var selectedCandidate = SelectJavDbCandidate(candidates, javIdForQuery, inputHandler, displayService, nameParser, autoConfirmSearch);
            if (selectedCandidate == null)
            {
                displayService.ShowInfo(_loc!.Get(L.Cancelled));
                return true;
            }

            var detail = await javDbProvider.GetDetailAsync(selectedCandidate.DetailUrl);
            var cacheProvider = services.GetService<IJavLocalCacheProvider>();
            if (cacheProvider != null)
            {
                if (string.IsNullOrWhiteSpace(detail.JavId))
                    detail.JavId = javIdForQuery;

                try
                {
                    await cacheProvider.SaveAsync(detail);
                }
                catch
                {
                    // 缓存写入失败不影响主流程
                }
            }
            var selectionService = services.GetRequiredService<TorrentSelectionService>();
            var sorted = selectionService.GetSortedTorrents(detail.Torrents);
            if (sorted.Count == 0)
            {
                displayService.ShowInfo($"{_loc!.Get(L.NoTorrentsFound)}: {javIdForQuery}");
                return true;
            }

            displayService.ShowSearchResults(sorted);

            // 交互模式：允许直接选择种子并创建下载任务
            if (!autoConfirmSearch)
            {
                AnsiConsole.WriteLine();
                var selectedIndex = inputHandler.GetTorrentIndexSelection(sorted.Count);
                if (selectedIndex == null)
                {
                    displayService.ShowInfo(_loc!.Get(L.Cancelled));
                    return true;
                }

                var selectedTorrent = sorted[selectedIndex.Value - 1];
                await ProcessDownloadAsync(javIdForQuery, selectedTorrent, displayService, inputHandler, javSearchService, autoConfirm: false);
            }
            return true;
        }

        if (cmd.Equals("c", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("cache", StringComparison.OrdinalIgnoreCase))
        {
            var cacheProvider = services.GetService<IJavLocalCacheProvider>();
            if (cacheProvider == null)
            {
                displayService.ShowInfo(_loc!.Get(L.CacheDisabled));
                return true;
            }

            var stats = await cacheProvider.GetStatisticsAsync();
            displayService.ShowCacheStatistics(stats);
            return true;
        }

        if (cmd.Equals("d", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("downloading", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("t", StringComparison.OrdinalIgnoreCase) ||
            cmd.Equals("downloads", StringComparison.OrdinalIgnoreCase))
        {
            var healthResultsForDownloads = healthResultsForInput ?? await healthCheckService.CheckAllAsync();
            serviceAvailability.UpdateFrom(healthResultsForDownloads);
            ShowUnhealthyServiceWarnings(
                displayService,
                healthResultsForDownloads,
                r => r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase));
            if (!serviceAvailability.DownloadQueueAvailable)
            {
                displayService.ShowError(_loc!.Get(L.QBittorrentUnavailable));
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
                displayService.ShowError(_loc!.Get(L.UsageSearch));
                return true;
            }

            var query = string.Join(" ", args.Skip(1));
            var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
            var torrentSelectionService = services.GetRequiredService<TorrentSelectionService>();
            var cacheProvider = services.GetService<IJavLocalCacheProvider>();
            await ProcessJavIdAsync(
                query,
                displayService,
                inputHandler,
                javSearchService,
                javDbProvider,
                torrentSelectionService,
                nameParser,
                serviceAvailability,
                services.GetRequiredService<IJavInfoTelemetryClient>(),
                cacheProvider,
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

    static (Dictionary<string, string> Overrides, string[] RemainingArgs) ExtractConfigurationOverrides(string[] args)
    {
        var overrides = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var remaining = new List<string>();

        var optionToConfigKey = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["--lang"] = "Console:Language",
            ["--language"] = "Console:Language",

            ["--everything-url"] = "Everything:BaseUrl",
            ["--everything-user"] = "Everything:UserName",
            ["--everything-username"] = "Everything:UserName",
            ["--everything-pass"] = "Everything:Password",
            ["--everything-password"] = "Everything:Password",

            ["--qb-url"] = "QBittorrent:BaseUrl",
            ["--qb-user"] = "QBittorrent:UserName",
            ["--qb-username"] = "QBittorrent:UserName",
            ["--qb-pass"] = "QBittorrent:Password",
            ["--qb-password"] = "QBittorrent:Password",

            ["--javdb-url"] = "JavDb:BaseUrl",
        };

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (arg == "--")
            {
                remaining.AddRange(args.Skip(i + 1));
                break;
            }

            var name = arg;
            string? value = null;
            var hasInlineValue = false;

            if (arg.StartsWith("--", StringComparison.Ordinal) && arg.Contains('=') && arg.Length > 3)
            {
                var idx = arg.IndexOf('=');
                name = arg[..idx];
                value = arg[(idx + 1)..];
                hasInlineValue = true;
            }

            if (optionToConfigKey.TryGetValue(name, out var configKey))
            {
                if (!hasInlineValue)
                {
                    if (i + 1 >= args.Length)
                        throw new ArgumentException($"Missing value for {name}.");
                    value = args[i + 1];
                    i++;
                }

                overrides[configKey] = value ?? string.Empty;
                continue;
            }

            remaining.Add(arg);
        }

        return (overrides, remaining.ToArray());
    }

    static string? TryGetAppHostDirectory()
    {
        var processPath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(processPath))
            return null;

        var fileName = Path.GetFileName(processPath);
        if (!fileName.Equals(AppInfo.Name, StringComparison.OrdinalIgnoreCase) &&
            !fileName.Equals($"{AppInfo.Name}.exe", StringComparison.OrdinalIgnoreCase))
            return null;

        return Path.GetDirectoryName(processPath);
    }

    static bool IsSameDirectory(string a, string b)
    {
        var pa = Path.GetFullPath(a).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var pb = Path.GetFullPath(b).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return pa.Equals(pb, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 构建配置
    /// </summary>
    static IConfiguration BuildConfiguration(IReadOnlyDictionary<string, string>? overrides)
    {
        // NOTE:
        // - For single-file releases, appsettings.json should be available without shipping an extra file.
        // - Allow users to override config by placing appsettings.json next to the executable.
        var basePath = AppContext.BaseDirectory;

        var appHostDir = TryGetAppHostDirectory();
        var embeddedAppSettingsBytes = TryGetEmbeddedAppSettingsJsonBytes();

        // If running as the native app host (single-file binary), create a user-editable config
        // next to the executable on first run. This keeps local-only settings out of the binary.
        if (!string.IsNullOrWhiteSpace(appHostDir) && embeddedAppSettingsBytes != null)
        {
            TryWriteAppSettingsJsonIfMissing(appHostDir, embeddedAppSettingsBytes);
        }

        MemoryStream? embeddedAppSettingsStream = embeddedAppSettingsBytes != null
            ? new MemoryStream(embeddedAppSettingsBytes, writable: false)
            : null;

        var builder = new ConfigurationBuilder()
            .SetBasePath(basePath);

        if (embeddedAppSettingsStream != null)
        {
            builder.AddJsonStream(embeddedAppSettingsStream);
        }

        builder
            .AddJsonFile("appsettings.json", optional: embeddedAppSettingsStream != null, reloadOnChange: true)
            .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables(prefix: "JAVMANAGER_");

        if (!string.IsNullOrWhiteSpace(appHostDir) && !IsSameDirectory(appHostDir, basePath))
        {
            builder
                .SetBasePath(appHostDir)
                .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true)
                .AddEnvironmentVariables(prefix: "JAVMANAGER_");
        }

        if (overrides != null && overrides.Count > 0)
        {
            builder.AddInMemoryCollection(
                overrides.Select(kvp => new KeyValuePair<string, string?>(kvp.Key, kvp.Value)));
        }

        var config = builder.Build();
        embeddedAppSettingsStream?.Dispose();
        return config;
    }

    static void TryWriteAppSettingsJsonIfMissing(string directory, byte[] templateBytes)
    {
        if (string.IsNullOrWhiteSpace(directory))
            return;

        var path = Path.Combine(directory, "appsettings.json");
        if (File.Exists(path))
            return;

        try
        {
            Directory.CreateDirectory(directory);
            File.WriteAllBytes(path, templateBytes);
        }
        catch
        {
            // ignore: writing config should never block startup
        }
    }

    static byte[]? TryGetEmbeddedAppSettingsJsonBytes()
    {
        var stream = TryOpenEmbeddedAppSettingsJson();
        if (stream == null)
            return null;

        try
        {
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            return ms.ToArray();
        }
        finally
        {
            stream.Dispose();
        }
    }

    static Stream? TryOpenEmbeddedAppSettingsJson()
    {
        var asm = typeof(Program).Assembly;

        // Prefer an exact resource name (RootNamespace + file name), but also allow
        // fallback scanning when the root namespace is changed.
        var exactName = $"{asm.GetName().Name}.appsettings.json";
        var exact = asm.GetManifestResourceStream(exactName);
        if (exact != null)
            return exact;

        var names = asm.GetManifestResourceNames();
        var fallbackName = names.FirstOrDefault(n => n.EndsWith(".appsettings.json", StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrWhiteSpace(fallbackName))
            return null;

        return asm.GetManifestResourceStream(fallbackName);
    }

    /// <summary>
    /// 创建主机构建器
    /// </summary>
    static IHostBuilder CreateHostBuilder(IConfiguration configuration, LocalizationService localizationService, bool includeGuiServices = false)
    {
        return Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                // 注册配置（IOptions 模式）
                services.Configure<EverythingConfig>(configuration.GetSection("Everything"));
                services.Configure<QBittorrentConfig>(configuration.GetSection("QBittorrent"));
	                services.Configure<JavDbConfig>(configuration.GetSection("JavDb"));
	                services.Configure<DownloadConfig>(configuration.GetSection("Download"));
	                services.Configure<TelemetryConfig>(configuration.GetSection("Telemetry"));
	                services.Configure<UpdateConfig>(configuration.GetSection("Update"));

                // 注册配置对象（直接注入）
                var everythingConfig = configuration.GetSection("Everything").Get<EverythingConfig>() ?? new EverythingConfig();
                var qbittorrentConfig = configuration.GetSection("QBittorrent").Get<QBittorrentConfig>() ?? new QBittorrentConfig();
                var javDbConfig = configuration.GetSection("JavDb").Get<JavDbConfig>() ?? new JavDbConfig();
	                var downloadConfig = configuration.GetSection("Download").Get<DownloadConfig>() ?? new DownloadConfig();
	                var localCacheConfig = configuration.GetSection("LocalCache").Get<LocalCacheConfig>() ?? new LocalCacheConfig();
	                var telemetryConfig = configuration.GetSection("Telemetry").Get<TelemetryConfig>() ?? new TelemetryConfig();
	                var updateConfig = configuration.GetSection("Update").Get<UpdateConfig>() ?? new UpdateConfig();

                // Backward compatibility: allow legacy "JavInfoSync" section (pre-telemetry refactor).
                // New config uses a single Telemetry.Endpoint (base endpoint) + Telemetry.Enabled.
                if (string.IsNullOrWhiteSpace(telemetryConfig.Endpoint))
                {
                    var legacyEndpoint = configuration.GetValue<string>("JavInfoSync:Endpoint");
                    var legacyBase = TelemetryEndpoints.NormalizeBaseEndpointOrNull(legacyEndpoint);
                    if (!string.IsNullOrWhiteSpace(legacyBase))
                        telemetryConfig.Endpoint = legacyBase;
                }

                var telemetryEnabledValue = configuration.GetValue<bool?>("Telemetry:Enabled");
                if (telemetryEnabledValue is null)
                {
                    var legacyEnabled = configuration.GetValue<bool?>("JavInfoSync:Enabled");
                    if (legacyEnabled.HasValue)
                        telemetryConfig.Enabled = legacyEnabled.Value;
                }

                services.AddSingleton(everythingConfig);
                services.AddSingleton(qbittorrentConfig);
                services.AddSingleton(javDbConfig);
	                services.AddSingleton(downloadConfig);
	                services.AddSingleton(localCacheConfig);
	                services.AddSingleton(telemetryConfig);
	                services.AddSingleton(updateConfig);

                // 注册本地化服务（使用 Main 中初始化的实例，确保语言一致）
                services.AddSingleton(localizationService);

                // 注册工具类
                services.AddSingleton<TorrentNameParser>();
                services.AddSingleton<WeightCalculator>();

                // 注册数据提供者
                services.AddSingleton<IJavDbHttpFetcher, CurlImpersonateHttpFetcher>();
                services.AddSingleton<IEverythingSearchProvider, EverythingHttpClient>();
                services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IEverythingSearchProvider>());
                services.AddSingleton<IQBittorrentClient, QBittorrentApiClient>();
                services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IQBittorrentClient>());
                services.AddSingleton<IJavDbDataProvider, JavDbWebScraper>();
                services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IJavDbDataProvider>());

                // 注册本地缓存提供者
                if (localCacheConfig.Enabled)
                    services.AddSingleton<IJavLocalCacheProvider, JsonJavCacheProvider>();

                // 运行时服务可用性（由健康检查更新）
                services.AddSingleton<ServiceAvailability>();

                // 注册服务
                services.AddSingleton<HealthCheckService>();
                services.AddSingleton<TorrentSelectionService>();
                services.AddSingleton<LocalFileCheckService>();
	                services.AddSingleton<DownloadService>();
	                services.AddSingleton<IJavInfoTelemetryClient, JavInfoTelemetryClient>();
	                services.AddSingleton<JavSearchService>();
	                services.AddSingleton<AppUpdateService>();

                // 注册 UI (Console)
                services.AddScoped<UserInputHandler>();
                services.AddScoped<DisplayService>();

                // 注册 GUI ViewModels
	                if (includeGuiServices)
	                {
	                    services.AddSingleton<GuiLocalization>();
	                    services.AddSingleton<GuiConfigFileService>();
	                    services.AddSingleton<IAppShutdownService, AvaloniaAppShutdownService>();
	                    services.AddSingleton<WindowsSelfUpdateApplier>();
	                    services.AddSingleton<SearchViewModel>();
	                    services.AddSingleton<DownloadsViewModel>();
	                    services.AddSingleton<SettingsViewModel>();
	                    services.AddSingleton<MainViewModel>();
	                }
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
        ServiceAvailability serviceAvailability,
        TorrentNameParser nameParser,
        IServiceProvider services,
        Task<List<HealthCheckResult>>? startupHealthCheckTask)
    {
        var startupHealthCheckShown = false;
        while (true)
        {
            try
            {
                AnsiConsole.WriteLine();
                if (!startupHealthCheckShown &&
                    startupHealthCheckTask != null &&
                    startupHealthCheckTask.IsCompletedSuccessfully)
                {
                    startupHealthCheckShown = true;
                    serviceAvailability.UpdateFrom(startupHealthCheckTask.Result);
                    displayService.ShowHealthCheckResults(startupHealthCheckTask.Result);
                }
                var input = inputHandler.GetJavId();

                // 退出命令
                if (input.Equals("quit", StringComparison.OrdinalIgnoreCase))
                {
                    displayService.ShowInfo(_loc!.Get(L.Goodbye));
                    break;
                }

                if (string.IsNullOrWhiteSpace(input))
                    continue;

                var cmdArgs = SplitArgs(input).ToArray();
                List<HealthCheckResult>? healthResultsForInput = null;
                try
                {
                    healthResultsForInput = await healthCheckService.CheckAllAsync();
                    serviceAvailability.UpdateFrom(healthResultsForInput);
                }
                catch (Exception ex)
                {
                    displayService.ShowError(_loc!.GetFormat(L.HealthCheckException, ex.Message));
                }

                if (cmdArgs.Length > 0 &&
                    await TryExecuteSubCommandAsync(
                        cmdArgs,
                        services,
                        displayService,
                        inputHandler,
                        javSearchService,
                        healthCheckService,
                        serviceAvailability,
                        nameParser,
                        autoConfirmSearch: false,
                        healthResultsForInput: healthResultsForInput))
                {
                    continue;
                }

                // 处理搜索和下载（默认子命令）
                var javDbProvider = services.GetRequiredService<IJavDbDataProvider>();
                var torrentSelectionService = services.GetRequiredService<TorrentSelectionService>();
                var cacheProvider = services.GetService<IJavLocalCacheProvider>();
                await ProcessJavIdAsync(
                    input,
                    displayService,
                    inputHandler,
                    javSearchService,
                    javDbProvider,
                    torrentSelectionService,
                    nameParser,
                    serviceAvailability,
                    services.GetRequiredService<IJavInfoTelemetryClient>(),
                    cacheProvider);
            }
            catch (Exception ex)
            {
                displayService.ShowError(_loc!.GetFormat(L.ErrorOccurred, ex.Message));
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
        ServiceAvailability serviceAvailability,
        IJavInfoTelemetryClient javInfoTelemetryClient,
        IJavLocalCacheProvider? cacheProvider = null,
        bool autoConfirm = false)
    {
        var normalizedJavId = nameParser.NormalizeJavId(javId);
        if (!IsValidJavId(normalizedJavId))
        {
            displayService.ShowError(_loc!.GetFormat(L.InvalidJavId, normalizedJavId));
            return;
        }

        javId = normalizedJavId;

        // 本地缓存优先（即使 JavDB 不可用也能工作）
        if (cacheProvider != null)
        {
            try
            {
                var cached = await cacheProvider.GetAsync(javId);
                if (cached != null && cached.Torrents.Count > 0)
                {
                    var sortedCached = torrentSelectionService.GetSortedTorrents(cached.Torrents);
                    displayService.ShowSearchResults(sortedCached);

                    AnsiConsole.WriteLine();
                    var cachedSelectedIndex = autoConfirm ? 1 : inputHandler.GetTorrentIndexSelection(sortedCached.Count);
                    if (cachedSelectedIndex == null)
                    {
                        displayService.ShowInfo(_loc!.Get(L.Cancelled));
                        return;
                    }

                    var selectedTorrentFromCache = sortedCached[cachedSelectedIndex.Value - 1];
                    await ProcessDownloadAsync(javId, selectedTorrentFromCache, displayService, inputHandler, javSearchService, autoConfirm);
                    return;
                }
            }
            catch
            {
                // 缓存异常不应阻塞主流程
            }
        }

        if (!serviceAvailability.RemoteSearchAvailable)
        {
            displayService.ShowError(_loc!.Get(L.JavDbUnavailable));
            return;
        }

        // 搜索
        await displayService.ShowLoadingAsync(_loc!.GetFormat(L.Searching, javId), async () =>
        {
            await Task.Delay(100); // 短暂延迟以显示动画
        });

        try
        {
            var candidates = await javDbProvider.SearchCandidatesAsync(javId);
            if (candidates.Count == 0)
            {
                displayService.ShowError($"{_loc!.Get(L.NoSearchResults)}: {javId}");
                return;
            }

            var selectedCandidate = SelectJavDbCandidate(candidates, javId, inputHandler, displayService, nameParser, autoConfirm);
            if (selectedCandidate == null)
            {
                displayService.ShowInfo(_loc!.Get(L.Cancelled));
                return;
            }

            var detail = await javDbProvider.GetDetailAsync(selectedCandidate.DetailUrl);
            if (string.IsNullOrWhiteSpace(detail.JavId))
                detail.JavId = javId;

            // Report JavInfo metadata (best-effort, non-blocking)
            javInfoTelemetryClient.TryReport(detail);

            if (cacheProvider != null)
            {
                try
                {
                    await cacheProvider.SaveAsync(detail);
                }
                catch
                {
                    // 缓存写入失败不影响主流程
                }
            }
            var sortedTorrents = torrentSelectionService.GetSortedTorrents(detail.Torrents);
            if (sortedTorrents.Count == 0)
            {
                displayService.ShowError($"{_loc!.Get(L.NoTorrentsFound)}: {javId}");
                return;
            }

            // 显示搜索结果（种子列表）
            displayService.ShowSearchResults(sortedTorrents);

            // 询问是否继续下载（非交互模式下自动确认）
            AnsiConsole.WriteLine();
            var selectedIndex = autoConfirm ? 1 : inputHandler.GetTorrentIndexSelection(sortedTorrents.Count);
            if (selectedIndex == null)
            {
                displayService.ShowInfo(_loc!.Get(L.Cancelled));
                return;
            }

            var selectedTorrent = sortedTorrents[selectedIndex.Value - 1];

            // 处理下载流程
            await ProcessDownloadAsync(javId, selectedTorrent, displayService, inputHandler, javSearchService, autoConfirm);
        }
        catch (Exception ex)
        {
            displayService.ShowError(_loc!.GetFormat(L.SearchFailed, ex.Message));
        }
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
                displayService.ShowInfo(_loc!.Get(L.LocalFileExistsSkip));
                return;
            }

            var selection = inputHandler.GetLocalFileSelection(result.LocalFiles);

            if (selection.IsCancelled)
            {
                displayService.ShowInfo(_loc!.Get(L.LocalFileSkipped));
                return;
            }

            if (selection.ForceDownload)
            {
                displayService.ShowInfo(_loc!.Get(L.LocalFileForceDownload));
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

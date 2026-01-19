using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using JavManager.Core.Configuration;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Services;
using JavManager.DataProviders.JavDb;
using JavManager.DataProviders.Everything;
using JavManager.DataProviders.QBittorrent;
using JavManager.Utils;
using JavManager.ConsoleUI;
using Spectre.Console;

namespace JavManager;

class Program
{
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
            var javId = ParseCommandLineArgs(args);

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
                }
            }

            // 如果提供了番号参数，直接处理（非交互模式）
            if (!string.IsNullOrEmpty(javId))
            {
                await ProcessJavIdAsync(javId, displayService, inputHandler, javSearchService, autoConfirm: true);
                return;
            }

            // 主循环（交互模式）
            await RunMainLoopAsync(displayService, inputHandler, javSearchService);
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
                services.Configure<AppConfig>(configuration);
                services.Configure<EverythingConfig>(configuration.GetSection("Everything"));
                services.Configure<QBittorrentConfig>(configuration.GetSection("QBittorrent"));
                services.Configure<JavDbConfig>(configuration.GetSection("JavDb"));
                services.Configure<DownloadConfig>(configuration.GetSection("Download"));
                services.Configure<WeightsConfig>(configuration.GetSection("Weights"));

                // 注册配置对象（直接注入）
                var appConfig = configuration.Get<AppConfig>() ?? new AppConfig();
                var everythingConfig = configuration.GetSection("Everything").Get<EverythingConfig>() ?? new EverythingConfig();
                var qbittorrentConfig = configuration.GetSection("QBittorrent").Get<QBittorrentConfig>() ?? new QBittorrentConfig();
                var javDbConfig = configuration.GetSection("JavDb").Get<JavDbConfig>() ?? new JavDbConfig();
                var downloadConfig = configuration.GetSection("Download").Get<DownloadConfig>() ?? new DownloadConfig();

                services.AddSingleton(appConfig);
                services.AddSingleton(everythingConfig);
                services.AddSingleton(qbittorrentConfig);
                services.AddSingleton(javDbConfig);
                services.AddSingleton(downloadConfig);

                // 注册工具类
                services.AddSingleton<TorrentNameParser>();
                services.AddSingleton<WeightCalculator>(sp => new WeightCalculator(appConfig.Weights));

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
        JavSearchService javSearchService)
    {
        while (true)
        {
            try
            {
                AnsiConsole.WriteLine();
                var javId = inputHandler.GetJavId();

                // 退出命令
                if (javId.Equals("quit", StringComparison.OrdinalIgnoreCase))
                {
                    displayService.ShowInfo("再见！");
                    break;
                }

                // 处理搜索和下载
                await ProcessJavIdAsync(javId, displayService, inputHandler, javSearchService);
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
        bool autoConfirm = false)
    {
        // 搜索
        await displayService.ShowLoadingAsync($"正在搜索 {javId}...", async () =>
        {
            await Task.Delay(100); // 短暂延迟以显示动画
        });

        var result = await javSearchService.SearchOnlyAsync(javId);

        if (!result.Success || result.AvailableTorrents.Count == 0)
        {
            displayService.ShowProcessResult(result);
            return;
        }

        // 显示搜索结果
        displayService.ShowSearchResults(result.AvailableTorrents);

        // 询问是否继续下载（非交互模式下自动确认）
        AnsiConsole.WriteLine();
        if (!autoConfirm && !inputHandler.Confirm("是否继续下载？"))
        {
            displayService.ShowInfo("已取消。");
            return;
        }

        // 处理下载流程
        await ProcessDownloadAsync(javId, displayService, inputHandler, javSearchService, autoConfirm);
    }

    /// <summary>
    /// 处理下载流程
    /// </summary>
    static async Task ProcessDownloadAsync(
        string javId,
        DisplayService displayService,
        UserInputHandler inputHandler,
        JavSearchService javSearchService,
        bool autoConfirm = false)
    {
        var result = await javSearchService.ProcessAsync(javId);

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
                var forceResult = await javSearchService.ForceDownloadAsync(javId);
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

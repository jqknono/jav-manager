using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.DataProviders.Everything;
using JavManager.DataProviders.JavDb;
using JavManager.DataProviders.LocalCache;
using JavManager.DataProviders.QBittorrent;
using JavManager.Gui.Localization;
using JavManager.Gui.Services;
using JavManager.Gui.ViewModels;
using JavManager.Localization;
using JavManager.Services;
using JavManager.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace JavManager.Gui;

internal static class GuiServiceProviderFactory
{
    public static IServiceProvider Create()
    {
        var config = BuildConfiguration();
        var localizationService = new LocalizationService(config);

        var services = new ServiceCollection();

        // IOptions registrations (optional, but harmless)
        services.Configure<EverythingConfig>(config.GetSection("Everything"));
        services.Configure<QBittorrentConfig>(config.GetSection("QBittorrent"));
        services.Configure<JavDbConfig>(config.GetSection("JavDb"));
        services.Configure<DownloadConfig>(config.GetSection("Download"));
        services.Configure<TelemetryConfig>(config.GetSection("Telemetry"));
        services.Configure<UpdateConfig>(config.GetSection("Update"));

        // Concrete config objects (direct injection)
        var everythingConfig = config.GetSection("Everything").Get<EverythingConfig>() ?? new EverythingConfig();
        var qbittorrentConfig = config.GetSection("QBittorrent").Get<QBittorrentConfig>() ?? new QBittorrentConfig();
        var javDbConfig = config.GetSection("JavDb").Get<JavDbConfig>() ?? new JavDbConfig();
        var downloadConfig = config.GetSection("Download").Get<DownloadConfig>() ?? new DownloadConfig();
        var localCacheConfig = config.GetSection("LocalCache").Get<LocalCacheConfig>() ?? new LocalCacheConfig();
        var telemetryConfig = config.GetSection("Telemetry").Get<TelemetryConfig>() ?? new TelemetryConfig();
        var updateConfig = config.GetSection("Update").Get<UpdateConfig>() ?? new UpdateConfig();

        // Backward compatibility: legacy "JavInfoSync" section (pre-telemetry refactor).
        if (string.IsNullOrWhiteSpace(telemetryConfig.Endpoint))
        {
            var legacyEndpoint = config.GetValue<string>("JavInfoSync:Endpoint");
            var legacyBase = TelemetryEndpoints.NormalizeBaseEndpointOrNull(legacyEndpoint);
            if (!string.IsNullOrWhiteSpace(legacyBase))
                telemetryConfig.Endpoint = legacyBase;
        }

        var telemetryEnabledValue = config.GetValue<bool?>("Telemetry:Enabled");
        if (telemetryEnabledValue is null)
        {
            var legacyEnabled = config.GetValue<bool?>("JavInfoSync:Enabled");
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

        // Localization
        services.AddSingleton(localizationService);

        // Utils
        services.AddSingleton<TorrentNameParser>();
        services.AddSingleton<WeightCalculator>();

        // Data providers
        services.AddSingleton<IJavDbHttpFetcher, CurlImpersonateHttpFetcher>();
        services.AddSingleton<IEverythingSearchProvider, EverythingHttpClient>();
        services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IEverythingSearchProvider>());
        services.AddSingleton<IQBittorrentClient, QBittorrentApiClient>();
        services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IQBittorrentClient>());
        services.AddSingleton<IJavDbDataProvider, JavDbWebScraper>();
        services.AddSingleton<IHealthChecker>(sp => (IHealthChecker)sp.GetRequiredService<IJavDbDataProvider>());

        // Local cache
        if (localCacheConfig.Enabled)
            services.AddSingleton<IJavLocalCacheProvider, JsonJavCacheProvider>();

        // Runtime availability + services
        services.AddSingleton<ServiceAvailability>();
        services.AddSingleton<HealthCheckService>();
        services.AddSingleton<TorrentSelectionService>();
        services.AddSingleton<LocalFileCheckService>();
        services.AddSingleton<DownloadService>();
        services.AddSingleton<IJavInfoTelemetryClient, JavInfoTelemetryClient>();
        services.AddSingleton<JavSearchService>();
        services.AddSingleton<AppUpdateService>();

        // GUI
        services.AddSingleton<GuiLocalization>();
        services.AddSingleton<GuiConfigFileService>();
        services.AddSingleton<IAppShutdownService, AvaloniaAppShutdownService>();
        services.AddSingleton<WindowsSelfUpdateApplier>();
        services.AddSingleton<SearchViewModel>();
        services.AddSingleton<DownloadsViewModel>();
        services.AddSingleton<SettingsViewModel>();
        services.AddSingleton<MainViewModel>();

        return services.BuildServiceProvider();
    }

    private static IConfiguration BuildConfiguration()
    {
        // Load embedded appsettings.json first (template/defaults), then allow a user-writable
        // appsettings.json override in our preferred config directory (important for Android).
        var basePath = AppContext.BaseDirectory;
        var builder = new ConfigurationBuilder().SetBasePath(basePath);

        var embeddedAppSettingsBytes = TryGetEmbeddedAppSettingsJsonBytes();
        if (embeddedAppSettingsBytes != null)
        {
            builder.AddJsonStream(new MemoryStream(embeddedAppSettingsBytes, writable: false));
            TryWriteAppSettingsJsonIfMissing(AppPaths.GetAppSettingsPath(), embeddedAppSettingsBytes);
        }

        // Preferred writable config (Android, etc.)
        builder.AddJsonFile(AppPaths.GetAppSettingsPath(), optional: true, reloadOnChange: true);

        // Also allow standard relative config in dev/test scenarios
        builder
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
            .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables(prefix: "JAVMANAGER_");

        return builder.Build();
    }

    private static void TryWriteAppSettingsJsonIfMissing(string path, byte[] templateBytes)
    {
        if (string.IsNullOrWhiteSpace(path))
            return;
        if (File.Exists(path))
            return;

        try
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrWhiteSpace(dir))
                Directory.CreateDirectory(dir);

            File.WriteAllBytes(path, templateBytes);
        }
        catch
        {
            // ignore: writing config should never block startup
        }
    }

    private static byte[]? TryGetEmbeddedAppSettingsJsonBytes()
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

    private static Stream? TryOpenEmbeddedAppSettingsJson()
    {
        var asm = typeof(GuiServiceProviderFactory).Assembly;

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
}

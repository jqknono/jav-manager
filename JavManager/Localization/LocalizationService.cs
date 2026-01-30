using System.Globalization;
using System.Resources;
using Microsoft.Extensions.Configuration;

namespace JavManager.Localization;

/// <summary>
/// 本地化服务 - 提供多语言支持
/// </summary>
public class LocalizationService
{
    private readonly ResourceManager _resourceManager;
    private CultureInfo _culture;

    public event EventHandler? LanguageChanged;

    /// <summary>
    /// 当前使用的语言文化
    /// </summary>
    public CultureInfo CurrentCulture => _culture;

    /// <summary>
    /// 是否为中文
    /// </summary>
    public bool IsChinese => _culture.TwoLetterISOLanguageName == "zh";

    public LocalizationService(IConfiguration? configuration = null)
    {
        _resourceManager = new ResourceManager(
            "JavManager.Localization.Strings",
            typeof(LocalizationService).Assembly);

        _culture = DetectCulture(configuration);
    }

    /// <summary>
    /// Detect output culture (English/Chinese only).
    /// </summary>
    private static CultureInfo DetectCulture(IConfiguration? configuration)
    {
        var language = configuration?.GetValue<string>("Console:Language");
        if (string.IsNullOrWhiteSpace(language))
            return new CultureInfo("en"); // default: English

        return ResolveCultureFromLanguageString(language);
    }

    public void SetLanguage(string language)
    {
        var next = ResolveCultureFromLanguageString(language);
        if (string.Equals(_culture.Name, next.Name, StringComparison.OrdinalIgnoreCase))
            return;

        _culture = next;
        LanguageChanged?.Invoke(this, EventArgs.Empty);
    }

    private static CultureInfo ResolveCultureFromLanguageString(string language)
    {
        if (string.IsNullOrWhiteSpace(language))
            return new CultureInfo("en");

        language = language.Trim();
        if (language.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            var ui = CultureInfo.CurrentUICulture;
            return ui.TwoLetterISOLanguageName.Equals("zh", StringComparison.OrdinalIgnoreCase)
                ? new CultureInfo("zh")
                : new CultureInfo("en");
        }

        if (language.StartsWith("zh", StringComparison.OrdinalIgnoreCase))
            return new CultureInfo("zh");
        if (language.StartsWith("en", StringComparison.OrdinalIgnoreCase))
            return new CultureInfo("en");

        return new CultureInfo("en");
    }

    /// <summary>
    /// 获取本地化字符串
    /// </summary>
    /// <param name="key">资源键</param>
    /// <returns>本地化字符串，如果未找到则返回键名</returns>
    public string Get(string key)
    {
        var value = _resourceManager.GetString(key, _culture);
        return value ?? key;
    }

    /// <summary>
    /// 获取本地化字符串并格式化
    /// </summary>
    /// <param name="key">资源键</param>
    /// <param name="args">格式化参数</param>
    /// <returns>格式化后的本地化字符串</returns>
    public string GetFormat(string key, params object[] args)
    {
        var format = Get(key);
        return string.Format(format, args);
    }
}

/// <summary>
/// 本地化字符串键常量
/// </summary>
public static class L
{
    // === 通用 ===
    public const string AppTitle = "AppTitle";
    public const string AppSubtitle = "AppSubtitle";
    public const string Version = "Version";
    public const string Error = "Error";
    public const string Warning = "Warning";
    public const string Info = "Info";
    public const string Success = "Success";
    public const string Cancelled = "Cancelled";
    public const string Goodbye = "Goodbye";
    public const string PressAnyKey = "PressAnyKey";

    // === 功能描述 ===
    public const string Features = "Features";
    public const string FeatureSearchJavDb = "FeatureSearchJavDb";
    public const string FeatureSmartSelection = "FeatureSmartSelection";
    public const string FeatureLocalCheck = "FeatureLocalCheck";
    public const string FeatureAutoDownload = "FeatureAutoDownload";

    // === 命令帮助 ===
    public const string Commands = "Commands";
    public const string CmdSearchDownload = "CmdSearchDownload";
    public const string CmdLocalSearch = "CmdLocalSearch";
    public const string CmdRemoteSearch = "CmdRemoteSearch";
    public const string CmdDownloading = "CmdDownloading";
    public const string CmdDownloads = "CmdDownloads";
    public const string CmdHealthCheck = "CmdHealthCheck";
    public const string CmdVersion = "CmdVersion";
    public const string CmdHelp = "CmdHelp";
    public const string CmdQuit = "CmdQuit";
    public const string CmdCacheStats = "CmdCacheStats";
    public const string CmdTestCurl = "CmdTestCurl";
    public const string CmdLang = "CmdLang";
    public const string CmdConfig = "CmdConfig";
    public const string HelpOptionsTitle = "HelpOptionsTitle";
    public const string OptLanguage = "OptLanguage";
    public const string OptEverythingUrl = "OptEverythingUrl";
    public const string OptEverythingUser = "OptEverythingUser";
    public const string OptEverythingPass = "OptEverythingPass";
    public const string OptQBittorrentUrl = "OptQBittorrentUrl";
    public const string OptQBittorrentUser = "OptQBittorrentUser";
    public const string OptQBittorrentPass = "OptQBittorrentPass";
    public const string OptJavDbUrl = "OptJavDbUrl";

    public const string UsageLang = "UsageLang";
    public const string LangSwitched = "LangSwitched";
    public const string UsageConfig = "UsageConfig";
    public const string ConfigUpdated = "ConfigUpdated";
    public const string HelpTitle = "HelpTitle";

    // === 提示语 ===
    public const string PromptInput = "PromptInput";
    public const string PromptTorrentSelection = "PromptTorrentSelection";
    public const string PromptSearchResultSelection = "PromptSearchResultSelection";
    public const string PromptLocalFileSelection = "PromptLocalFileSelection";
    public const string PromptInvalidInput = "PromptInvalidInput";
    public const string PromptInvalidInputRange = "PromptInvalidInputRange";

    // === 本地文件选择 ===
    public const string LocalFileExists = "LocalFileExists";
    public const string LocalFileOption1Skip = "LocalFileOption1Skip";
    public const string LocalFileOption2Force = "LocalFileOption2Force";
    public const string LocalFileOption3Details = "LocalFileOption3Details";
    public const string LocalFileSkipped = "LocalFileSkipped";
    public const string LocalFileForceDownload = "LocalFileForceDownload";
    public const string LocalFileExistsSkip = "LocalFileExistsSkip";

    // === 表格标题 ===
    public const string TableIndex = "TableIndex";
    public const string TableTitle = "TableTitle";
    public const string TableUncensored = "TableUncensored";
    public const string TableSubtitle = "TableSubtitle";
    public const string TableHD = "TableHD";
    public const string TableSize = "TableSize";
    public const string TableFileName = "TableFileName";
    public const string TablePath = "TablePath";
    public const string TableProgress = "TableProgress";
    public const string TableState = "TableState";
    public const string TableJavId = "TableJavId";
    public const string TableService = "TableService";
    public const string TableStatus = "TableStatus";
    public const string TableMessage = "TableMessage";
    public const string TableUrl = "TableUrl";
    public const string TableItem = "TableItem";
    public const string TableValue = "TableValue";

    // === 搜索结果 ===
    public const string NoTorrentsFound = "NoTorrentsFound";
    public const string NoSearchResults = "NoSearchResults";
    public const string NoDownloads = "NoDownloads";
    public const string NoLocalFiles = "NoLocalFiles";
    public const string Searching = "Searching";
    public const string SearchFailed = "SearchFailed";

    // === 处理结果 ===
    public const string LocalFilesExist = "LocalFilesExist";
    public const string DownloadAdded = "DownloadAdded";
    public const string DownloadSkipped = "DownloadSkipped";
    public const string MagnetLinkManual = "MagnetLinkManual";
    public const string ProcessFailed = "ProcessFailed";
    public const string LocalDedupSkipped = "LocalDedupSkipped";
    public const string MarkerHD = "MarkerHD";
    public const string MarkerUncensored = "MarkerUncensored";
    public const string MarkerSubtitle = "MarkerSubtitle";
    public const string MarkerNone = "MarkerNone";
    public const string Markers = "Markers";

    // === 健康检查 ===
    public const string HealthCheckTitle = "HealthCheckTitle";
    public const string HealthCheckNoCheckers = "HealthCheckNoCheckers";
    public const string StatusHealthy = "StatusHealthy";
    public const string StatusUnhealthy = "StatusUnhealthy";
    public const string UnhealthyWarning = "UnhealthyWarning";
    public const string AllServicesHealthy = "AllServicesHealthy";
    public const string HealthCheckException = "HealthCheckException";
    public const string HealthCheckStarted = "HealthCheckStarted";

    // === 服务提示 ===
    public const string EverythingSetupHint = "EverythingSetupHint";
    public const string EverythingDownload = "EverythingDownload";
    public const string EverythingPlugin = "EverythingPlugin";
    public const string EverythingConfig = "EverythingConfig";
    public const string QBittorrentSetupHint = "QBittorrentSetupHint";
    public const string QBittorrentDownload = "QBittorrentDownload";
    public const string QBittorrentEnhanced = "QBittorrentEnhanced";
    public const string QBittorrentConfig = "QBittorrentConfig";
    public const string ConfigHint = "ConfigHint";

    // === 服务错误 ===
    public const string JavDbUnavailable = "JavDbUnavailable";
    public const string EverythingUnavailable = "EverythingUnavailable";
    public const string QBittorrentUnavailable = "QBittorrentUnavailable";

    // === 服务名称 ===
    public const string ServiceNameEverything = "ServiceNameEverything";
    public const string ServiceNameQBittorrent = "ServiceNameQBittorrent";
    public const string ServiceNameJavDb = "ServiceNameJavDb";

    // === 健康检查消息 ===
    public const string HealthServiceOk = "HealthServiceOk";
    public const string HealthConnectionFailed = "HealthConnectionFailed";
    public const string HealthAllUrlsFailed = "HealthAllUrlsFailed";

    // === JavSearchService 消息 ===
    public const string LocalDedupUnavailableSkipped = "LocalDedupUnavailableSkipped";
    public const string LocalDedupException = "LocalDedupException";
    public const string DownloaderUnavailableSkipped = "DownloaderUnavailableSkipped";
    public const string DownloaderException = "DownloaderException";
    public const string LogSelectedTorrent = "LogSelectedTorrent";
    public const string LogTorrentMarkers = "LogTorrentMarkers";
    public const string LogCheckingLocalFiles = "LogCheckingLocalFiles";
    public const string LogStartDownload = "LogStartDownload";
    public const string LogDownloadTaskAddedWithTitle = "LogDownloadTaskAddedWithTitle";
    public const string LogAddToQueueFailedShowingMagnet = "LogAddToQueueFailedShowingMagnet";
    public const string LogSearchingCache = "LogSearchingCache";
    public const string LogCacheFoundTorrents = "LogCacheFoundTorrents";
    public const string LogCacheHitAt = "LogCacheHitAt";
    public const string LogSearchingRemote = "LogSearchingRemote";
    public const string LogRemoteFoundTorrents = "LogRemoteFoundTorrents";
    public const string LogSavedToCache = "LogSavedToCache";
    public const string LogNoTorrentsForId = "LogNoTorrentsForId";
    public const string LogNoAvailableTorrents = "LogNoAvailableTorrents";
    public const string LogSearchFailedWithMessage = "LogSearchFailedWithMessage";
    public const string LogProcessFailedWithMessage = "LogProcessFailedWithMessage";

    // === JavDB 爬虫错误 ===
    public const string JavDbHomeRequestFailed = "JavDbHomeRequestFailed";
    public const string JavDbSearchRequestFailed = "JavDbSearchRequestFailed";
    public const string JavDbHttpRequestFailed = "JavDbHttpRequestFailed";

    // === 缓存 ===
    public const string CacheStatsTitle = "CacheStatsTitle";
    public const string CacheDisabled = "CacheDisabled";
    public const string CacheJavCount = "CacheJavCount";
    public const string CacheTorrentCount = "CacheTorrentCount";
    public const string CacheDbSize = "CacheDbSize";
    public const string CacheLastUpdated = "CacheLastUpdated";

    // === JAV 详情 ===
    public const string DetailJavId = "DetailJavId";
    public const string DetailTitle = "DetailTitle";
    public const string DetailReleaseDate = "DetailReleaseDate";
    public const string DetailDuration = "DetailDuration";
    public const string DetailDirector = "DetailDirector";
    public const string DetailMaker = "DetailMaker";
    public const string DetailPublisher = "DetailPublisher";
    public const string DetailSeries = "DetailSeries";
    public const string DetailActors = "DetailActors";
    public const string DetailCategories = "DetailCategories";
    public const string DetailDataSource = "DetailDataSource";
    public const string DetailCachedAt = "DetailCachedAt";
    public const string DetailTorrentCount = "DetailTorrentCount";
    public const string DurationMinutes = "DurationMinutes";

    // === 用法提示 ===
    public const string UsageLocalSearch = "UsageLocalSearch";
    public const string UsageRemoteSearch = "UsageRemoteSearch";
    public const string UsageSearch = "UsageSearch";
    public const string InvalidJavId = "InvalidJavId";
    public const string NoFilesOverSize = "NoFilesOverSize";

    // === 错误消息 ===
    public const string ErrorOccurred = "ErrorOccurred";
}

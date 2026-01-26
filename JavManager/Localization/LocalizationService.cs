using System.Globalization;
using System.Resources;

namespace JavManager.Localization;

/// <summary>
/// 本地化服务 - 提供多语言支持
/// </summary>
public class LocalizationService
{
    private readonly ResourceManager _resourceManager;
    private readonly CultureInfo _culture;

    /// <summary>
    /// 当前使用的语言文化
    /// </summary>
    public CultureInfo CurrentCulture => _culture;

    /// <summary>
    /// 是否为中文
    /// </summary>
    public bool IsChinese => _culture.TwoLetterISOLanguageName == "zh";

    public LocalizationService()
    {
        _resourceManager = new ResourceManager(
            "JavManager.Localization.Strings",
            typeof(LocalizationService).Assembly);

        _culture = DetectCulture();
    }

    /// <summary>
    /// Always use English for all logs and output
    /// </summary>
    private static CultureInfo DetectCulture()
    {
        // Force English for all logs and output
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

using System.IO;
using System.Text;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Localization;

namespace JavManager.Services;

/// <summary>
/// JAV 搜索服务（主业务编排）
/// </summary>
public class JavSearchService
{
    private readonly IJavDbDataProvider _javDbProvider;
    private readonly IJavLocalCacheProvider? _cacheProvider;
    private readonly TorrentSelectionService _selectionService;
    private readonly LocalFileCheckService _localFileService;
    private readonly DownloadService _downloadService;
    private readonly ServiceAvailability _serviceAvailability;
    private readonly LocalizationService _loc;

    private const string LogInfoPrefix = "[INFO] ";
    private const string LogWarnPrefix = "[WARN] ";
    private const string LogErrorPrefix = "[ERROR] ";
    private const string LogSuccessPrefix = "[OK] ";

    public JavSearchService(
        IJavDbDataProvider javDbProvider,
        TorrentSelectionService selectionService,
        LocalFileCheckService localFileService,
        DownloadService downloadService,
        ServiceAvailability serviceAvailability,
        LocalizationService localizationService,
        IJavLocalCacheProvider? cacheProvider = null)
    {
        _javDbProvider = javDbProvider;
        _selectionService = selectionService;
        _localFileService = localFileService;
        _downloadService = downloadService;
        _serviceAvailability = serviceAvailability;
        _loc = localizationService;
        _cacheProvider = cacheProvider;
    }

    private static void AppendLog(StringBuilder sb, string prefix, string message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return;

        using var reader = new StringReader(message);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            sb.AppendLine(prefix + line);
        }
    }

    private static void LogInfo(StringBuilder sb, string message) => AppendLog(sb, LogInfoPrefix, message);
    private static void LogWarning(StringBuilder sb, string message) => AppendLog(sb, LogWarnPrefix, message);
    private static void LogError(StringBuilder sb, string message) => AppendLog(sb, LogErrorPrefix, message);
    private static void LogSuccess(StringBuilder sb, string message) => AppendLog(sb, LogSuccessPrefix, message);

    /// <summary>
    /// 执行完整的搜索和下载流程
    /// </summary>
    /// <param name="javId">番号</param>
    /// <param name="forceDownload">是否强制下载（忽略本地文件检查）</param>
    /// <param name="forceRemote">是否强制从远端搜索（忽略本地缓存）</param>
    /// <returns>操作结果</returns>
    public async Task<JavSearchProcessResult> ProcessAsync(string javId, bool forceDownload = false, bool forceRemote = false)
    {
        var result = new JavSearchProcessResult { JavId = javId };

        try
        {
            // 步骤 1: 优先从本地缓存搜索
            JavSearchResult? searchResult = null;
            
            if (!forceRemote && _cacheProvider != null)
            {
                LogInfo(result.Message, _loc.GetFormat(L.LogSearchingCache, javId));
                searchResult = await _cacheProvider.GetAsync(javId);
                
                if (searchResult != null && searchResult.Torrents.Count > 0)
                {
                    LogInfo(result.Message, _loc.GetFormat(L.LogCacheFoundTorrents, searchResult.Torrents.Count));
                    result.Message.AppendLine();
                }
                else
                {
                    searchResult = null;
                }
            }

            // 步骤 2: 本地未找到，从远端搜索
            if (searchResult == null)
            {
                if (!_serviceAvailability.RemoteSearchAvailable)
                {
                    result.Success = false;
                    LogError(result.Message, _loc.Get(L.JavDbUnavailable));
                    return result;
                }

                LogInfo(result.Message, _loc.GetFormat(L.LogSearchingRemote, javId));
                searchResult = await _javDbProvider.SearchAsync(javId);

                if (searchResult.Torrents.Count == 0)
                {
                    result.Success = false;
                    LogError(result.Message, _loc.GetFormat(L.LogNoTorrentsForId, javId));
                    return result;
                }

                LogInfo(result.Message, _loc.GetFormat(L.LogRemoteFoundTorrents, searchResult.Torrents.Count));
                
                // 保存到本地缓存
                if (_cacheProvider != null)
                {
                    await _cacheProvider.SaveAsync(searchResult);
                    LogInfo(result.Message, _loc.Get(L.LogSavedToCache));
                }
                
                result.Message.AppendLine();
            }

            if (searchResult.Torrents.Count == 0)
            {
                result.Success = false;
                LogError(result.Message, _loc.GetFormat(L.LogNoTorrentsForId, javId));
                return result;
            }

            // 步骤 2: 选择最佳种子
            var selectedTorrent = _selectionService.SelectBestTorrent(searchResult.Torrents);
            if (selectedTorrent == null)
            {
                result.Success = false;
                LogError(result.Message, _loc.Get(L.LogNoAvailableTorrents));
                return result;
            }

            result.SelectedTorrent = selectedTorrent;
            LogInfo(result.Message, _loc.GetFormat(L.LogSelectedTorrent, selectedTorrent.Title));
            var markers = new List<string>();
            if (selectedTorrent.HasHd) markers.Add(_loc.Get(L.MarkerHD));
            if (selectedTorrent.HasUncensoredMarker) markers.Add(_loc.Get(L.MarkerUncensored));
            if (selectedTorrent.HasSubtitle) markers.Add(_loc.Get(L.MarkerSubtitle));
            var markerText = markers.Count > 0 ? string.Join(", ", markers) : _loc.Get(L.MarkerNone);
            LogInfo(result.Message, _loc.GetFormat(L.LogTorrentMarkers, markerText, selectedTorrent.WeightScore));
            result.Message.AppendLine();

            // 步骤 3: 检查本地文件
            if (!forceDownload)
            {
                if (!_serviceAvailability.LocalDedupAvailable)
                {
                    result.LocalDedupSkipped = true;
                    LogWarning(result.Message, _loc.Get(L.LocalDedupUnavailableSkipped));
                }
                else
                {
                    try
                    {
                        LogInfo(result.Message, _loc.Get(L.LogCheckingLocalFiles));
                        var localFiles = await _localFileService.CheckLocalFilesAsync(javId);

                        if (localFiles.Count > 0)
                        {
                            result.LocalFilesFound = true;
                            result.LocalFiles = localFiles;
                            result.Success = true;
                            return result;
                        }
                    }
                    catch (Exception ex)
                    {
                        result.LocalDedupSkipped = true;
                        LogWarning(result.Message, _loc.GetFormat(L.LocalDedupException, ex.Message));
                    }
                }

                LogInfo(result.Message, _loc.Get(L.LogStartDownload));
            }

            // 步骤 4: 执行下载
            if (!_serviceAvailability.DownloadQueueAvailable)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                LogWarning(result.Message, _loc.Get(L.DownloaderUnavailableSkipped));
                LogWarning(result.Message, _loc.Get(L.MagnetLinkManual));
                result.Message.AppendLine(result.MagnetLink);
                return result;
            }

            try
            {
                var downloadSuccess = await _downloadService.AddDownloadAsync(selectedTorrent);
                if (downloadSuccess)
                {
                    result.Success = true;
                    result.Downloaded = true;
                    LogSuccess(result.Message, _loc.GetFormat(L.LogDownloadTaskAddedWithTitle, selectedTorrent.Title));
                }
                else
                {
                    result.Success = true;
                    result.DownloadQueueSkipped = true;
                    result.MagnetLink = selectedTorrent.MagnetLink;
                    LogWarning(result.Message, _loc.Get(L.LogAddToQueueFailedShowingMagnet));
                    LogWarning(result.Message, _loc.Get(L.MagnetLinkManual));
                    result.Message.AppendLine(result.MagnetLink);
                }
            }
            catch (Exception ex)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                LogWarning(result.Message, _loc.GetFormat(L.DownloaderException, ex.Message));
                LogWarning(result.Message, _loc.Get(L.MagnetLinkManual));
                result.Message.AppendLine(result.MagnetLink);
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            LogError(result.Message, _loc.GetFormat(L.LogProcessFailedWithMessage, ex.Message));
            return result;
        }
    }

    /// <summary>
    /// 强制下载（跳过本地检查）
    /// </summary>
    public async Task<JavSearchProcessResult> ProcessSelectedTorrentAsync(
        string javId,
        TorrentInfo selectedTorrent,
        bool forceDownload = false)
    {
        var result = new JavSearchProcessResult
        {
            JavId = javId,
            SelectedTorrent = selectedTorrent
        };

        try
        {
            LogInfo(result.Message, _loc.GetFormat(L.LogSelectedTorrent, selectedTorrent.Title));
            var markers = new List<string>();
            if (selectedTorrent.HasHd) markers.Add(_loc.Get(L.MarkerHD));
            if (selectedTorrent.HasUncensoredMarker) markers.Add(_loc.Get(L.MarkerUncensored));
            if (selectedTorrent.HasSubtitle) markers.Add(_loc.Get(L.MarkerSubtitle));
            var markerText = markers.Count > 0 ? string.Join(", ", markers) : _loc.Get(L.MarkerNone);
            LogInfo(result.Message, _loc.GetFormat(L.LogTorrentMarkers, markerText, selectedTorrent.WeightScore));
            result.Message.AppendLine();

            if (!forceDownload)
            {
                if (!_serviceAvailability.LocalDedupAvailable)
                {
                    result.LocalDedupSkipped = true;
                    LogWarning(result.Message, _loc.Get(L.LocalDedupUnavailableSkipped));
                }
                else
                {
                    try
                    {
                        LogInfo(result.Message, _loc.Get(L.LogCheckingLocalFiles));
                        var localFiles = await _localFileService.CheckLocalFilesAsync(javId);

                        if (localFiles.Count > 0)
                        {
                            result.LocalFilesFound = true;
                            result.LocalFiles = localFiles;
                            result.Success = true;
                            return result;
                        }
                    }
                    catch (Exception ex)
                    {
                        result.LocalDedupSkipped = true;
                        LogWarning(result.Message, _loc.GetFormat(L.LocalDedupException, ex.Message));
                    }
                }

                LogInfo(result.Message, _loc.Get(L.LogStartDownload));
            }

            if (!_serviceAvailability.DownloadQueueAvailable)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                LogWarning(result.Message, _loc.Get(L.DownloaderUnavailableSkipped));
                LogWarning(result.Message, _loc.Get(L.MagnetLinkManual));
                result.Message.AppendLine(result.MagnetLink);
                return result;
            }

            try
            {
                var downloadSuccess = await _downloadService.AddDownloadAsync(selectedTorrent);
                if (downloadSuccess)
                {
                    result.Success = true;
                    result.Downloaded = true;
                    LogSuccess(result.Message, _loc.GetFormat(L.LogDownloadTaskAddedWithTitle, selectedTorrent.Title));
                }
                else
                {
                    result.Success = true;
                    result.DownloadQueueSkipped = true;
                    result.MagnetLink = selectedTorrent.MagnetLink;
                    LogWarning(result.Message, _loc.Get(L.LogAddToQueueFailedShowingMagnet));
                    LogWarning(result.Message, _loc.Get(L.MagnetLinkManual));
                    result.Message.AppendLine(result.MagnetLink);
                }
            }
            catch (Exception ex)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                LogWarning(result.Message, _loc.GetFormat(L.DownloaderException, ex.Message));
                LogWarning(result.Message, _loc.Get(L.MagnetLinkManual));
                result.Message.AppendLine(result.MagnetLink);
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            LogError(result.Message, _loc.GetFormat(L.LogProcessFailedWithMessage, ex.Message));
            return result;
        }
    }

    public async Task<JavSearchProcessResult> ForceDownloadAsync(string javId)
    {
        return await ProcessAsync(javId, forceDownload: true);
    }

    /// <summary>
    /// 仅搜索不下载
    /// </summary>
    /// <param name="javId">番号</param>
    /// <param name="forceRemote">是否强制从远端搜索</param>
    public async Task<JavSearchProcessResult> SearchOnlyAsync(string javId, bool forceRemote = false)
    {
        var result = new JavSearchProcessResult { JavId = javId };

        try
        {
            JavSearchResult? searchResult = null;

            // 优先从本地缓存搜索
            if (!forceRemote && _cacheProvider != null)
            {
                LogInfo(result.Message, _loc.GetFormat(L.LogSearchingCache, javId));
                searchResult = await _cacheProvider.GetAsync(javId);
                
                if (searchResult != null && searchResult.Torrents.Count > 0)
                {
                    var cachedAtText = searchResult.CachedAt?.ToString("yyyy-MM-dd HH:mm") ?? "-";
                    LogInfo(result.Message, _loc.GetFormat(L.LogCacheHitAt, cachedAtText));
                }
                else
                {
                    searchResult = null;
                }
            }

            // 本地未找到，从远端搜索
            if (searchResult == null)
            {
                if (!_serviceAvailability.RemoteSearchAvailable)
                {
                    result.Success = false;
                    LogError(result.Message, _loc.Get(L.JavDbUnavailable));
                    return result;
                }

                LogInfo(result.Message, _loc.GetFormat(L.LogSearchingRemote, javId));
                searchResult = await _javDbProvider.SearchAsync(javId);

                if (searchResult.Torrents.Count == 0)
                {
                    result.Success = false;
                    LogError(result.Message, _loc.GetFormat(L.LogNoTorrentsForId, javId));
                    return result;
                }

                // 保存到本地缓存
                if (_cacheProvider != null)
                {
                    await _cacheProvider.SaveAsync(searchResult);
                    LogInfo(result.Message, _loc.Get(L.LogSavedToCache));
                }
            }

            result.AvailableTorrents = _selectionService.GetSortedTorrents(searchResult.Torrents);
            result.Success = result.AvailableTorrents.Count > 0;

            // 添加详细信息到结果
            result.SearchResult = searchResult;

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            LogError(result.Message, _loc.GetFormat(L.LogSearchFailedWithMessage, ex.Message));
            return result;
        }
    }

    /// <summary>
    /// 获取缓存统计信息
    /// </summary>
    public async Task<CacheStatistics?> GetCacheStatisticsAsync()
    {
        if (_cacheProvider == null)
            return null;
        
        return await _cacheProvider.GetStatisticsAsync();
    }
}

/// <summary>
/// 搜索处理结果
/// </summary>
public class JavSearchProcessResult
{
    /// <summary>
    /// 番号
    /// </summary>
    public string JavId { get; set; } = string.Empty;

    /// <summary>
    /// 是否成功
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// 是否已下载
    /// </summary>
    public bool Downloaded { get; set; }

    /// <summary>
    /// 是否找到本地文件
    /// </summary>
    public bool LocalFilesFound { get; set; }

    /// <summary>
    /// 是否跳过本地搜索去重（Everything 异常或不可用）
    /// </summary>
    public bool LocalDedupSkipped { get; set; }

    /// <summary>
    /// 选中的种子
    /// </summary>
    public TorrentInfo? SelectedTorrent { get; set; }

    /// <summary>
    /// 是否跳过自动加入下载队列（下载器异常或不可用）
    /// </summary>
    public bool DownloadQueueSkipped { get; set; }

    /// <summary>
    /// 当无法自动加入下载队列时，提供磁力链接供手动下载
    /// </summary>
    public string? MagnetLink { get; set; }

    /// <summary>
    /// 本地文件列表
    /// </summary>
    public List<LocalFileInfo> LocalFiles { get; set; } = new();

    /// <summary>
    /// 可用的种子列表
    /// </summary>
    public List<TorrentInfo> AvailableTorrents { get; set; } = new();

    /// <summary>
    /// 完整搜索结果（含详细信息）
    /// </summary>
    public JavSearchResult? SearchResult { get; set; }

    /// <summary>
    /// 处理消息
    /// </summary>
    public StringBuilder Message { get; set; } = new();
}

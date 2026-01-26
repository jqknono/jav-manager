using System.Text;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;

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

    public JavSearchService(
        IJavDbDataProvider javDbProvider,
        TorrentSelectionService selectionService,
        LocalFileCheckService localFileService,
        DownloadService downloadService,
        ServiceAvailability serviceAvailability,
        IJavLocalCacheProvider? cacheProvider = null)
    {
        _javDbProvider = javDbProvider;
        _selectionService = selectionService;
        _localFileService = localFileService;
        _downloadService = downloadService;
        _serviceAvailability = serviceAvailability;
        _cacheProvider = cacheProvider;
    }

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
                result.Message.AppendLine($"正在从本地缓存搜索 {javId}...");
                searchResult = await _cacheProvider.GetAsync(javId);
                
                if (searchResult != null && searchResult.Torrents.Count > 0)
                {
                    result.Message.AppendLine($"[本地缓存] 找到 {searchResult.Torrents.Count} 个种子源。");
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
                    result.Message.AppendLine("JavDB 服务异常：不支持远程搜索能力。");
                    return result;
                }

                result.Message.AppendLine($"正在从远端搜索 {javId}...");
                searchResult = await _javDbProvider.SearchAsync(javId);

                if (searchResult.Torrents.Count == 0)
                {
                    result.Success = false;
                    result.Message.AppendLine($"未找到 {javId} 的种子。");
                    return result;
                }

                result.Message.AppendLine($"[远端] 找到 {searchResult.Torrents.Count} 个种子源。");
                
                // 保存到本地缓存
                if (_cacheProvider != null)
                {
                    await _cacheProvider.SaveAsync(searchResult);
                    result.Message.AppendLine("已缓存到本地数据库。");
                }
                
                result.Message.AppendLine();
            }

            if (searchResult.Torrents.Count == 0)
            {
                result.Success = false;
                result.Message.AppendLine($"未找到 {javId} 的种子。");
                return result;
            }

            result.Message.AppendLine($"找到 {searchResult.Torrents.Count} 个种子源。");
            result.Message.AppendLine();

            // 步骤 2: 选择最佳种子
            var selectedTorrent = _selectionService.SelectBestTorrent(searchResult.Torrents);
            if (selectedTorrent == null)
            {
                result.Success = false;
                result.Message.AppendLine("没有可用的种子。");
                return result;
            }

            result.SelectedTorrent = selectedTorrent;
            result.Message.AppendLine($"选择种子: {selectedTorrent.Title}");
            var markers = new List<string>();
            if (selectedTorrent.HasHd) markers.Add("高清");
            if (selectedTorrent.HasUncensoredMarker) markers.Add("无码");
            if (selectedTorrent.HasSubtitle) markers.Add("字幕");
            var markerText = markers.Count > 0 ? string.Join(", ", markers) : "无";
            result.Message.AppendLine($"标记: {markerText} (共 {selectedTorrent.WeightScore:0} 个)");
            result.Message.AppendLine();

            // 步骤 3: 检查本地文件
            if (!forceDownload)
            {
                if (!_serviceAvailability.LocalDedupAvailable)
                {
                    result.LocalDedupSkipped = true;
                    result.Message.AppendLine("本地搜索去重不可用（Everything 服务异常），已跳过本地检查。");
                }
                else
                {
                    try
                    {
                        result.Message.AppendLine("检查本地文件...");
                        var localFiles = await _localFileService.CheckLocalFilesAsync(javId);

                        if (localFiles.Count > 0)
                        {
                            result.LocalFilesFound = true;
                            result.LocalFiles = localFiles;
                            result.Message.AppendLine(_localFileService.FormatLocalFileInfo(localFiles));
                            result.Success = true;
                            return result;
                        }
                    }
                    catch (Exception ex)
                    {
                        result.LocalDedupSkipped = true;
                        result.Message.AppendLine($"本地搜索去重不可用（Everything 异常）：{ex.Message}");
                    }
                }

                result.Message.AppendLine("本地文件不存在或未检查，开始下载...");
            }

            // 步骤 4: 执行下载
            if (!_serviceAvailability.DownloadQueueAvailable)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                result.Message.AppendLine("下载器不可用（qBittorrent 服务异常），未自动加入下载队列。");
                result.Message.AppendLine("请手动使用磁力链接下载：");
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
                    result.Message.AppendLine($"下载任务已添加: {selectedTorrent.Title}");
                }
                else
                {
                    result.Success = true;
                    result.DownloadQueueSkipped = true;
                    result.MagnetLink = selectedTorrent.MagnetLink;
                    result.Message.AppendLine("未能自动加入下载队列，已显示磁力链接：");
                    result.Message.AppendLine(result.MagnetLink);
                }
            }
            catch (Exception ex)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                result.Message.AppendLine($"下载器异常，未能自动加入下载队列：{ex.Message}");
                result.Message.AppendLine("已显示磁力链接：");
                result.Message.AppendLine(result.MagnetLink);
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message.AppendLine($"处理失败: {ex.Message}");
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
            result.Message.AppendLine($"选择种子: {selectedTorrent.Title}");
            var markers = new List<string>();
            if (selectedTorrent.HasHd) markers.Add("高清");
            if (selectedTorrent.HasUncensoredMarker) markers.Add("无码");
            if (selectedTorrent.HasSubtitle) markers.Add("字幕");
            var markerText = markers.Count > 0 ? string.Join(", ", markers) : "无";
            result.Message.AppendLine($"标记: {markerText} (共 {selectedTorrent.WeightScore:0} 个)");
            result.Message.AppendLine();

            if (!forceDownload)
            {
                if (!_serviceAvailability.LocalDedupAvailable)
                {
                    result.LocalDedupSkipped = true;
                    result.Message.AppendLine("本地搜索去重不可用（Everything 服务异常），已跳过本地检查。");
                }
                else
                {
                    try
                    {
                        result.Message.AppendLine("检查本地文件...");
                        var localFiles = await _localFileService.CheckLocalFilesAsync(javId);

                        if (localFiles.Count > 0)
                        {
                            result.LocalFilesFound = true;
                            result.LocalFiles = localFiles;
                            result.Message.AppendLine(_localFileService.FormatLocalFileInfo(localFiles));
                            result.Success = true;
                            return result;
                        }
                    }
                    catch (Exception ex)
                    {
                        result.LocalDedupSkipped = true;
                        result.Message.AppendLine($"本地搜索去重不可用（Everything 异常）：{ex.Message}");
                    }
                }

                result.Message.AppendLine("本地文件不存在或未检查，开始下载...");
            }

            if (!_serviceAvailability.DownloadQueueAvailable)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                result.Message.AppendLine("下载器不可用（qBittorrent 服务异常），未自动加入下载队列。");
                result.Message.AppendLine("请手动使用磁力链接下载：");
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
                    result.Message.AppendLine($"下载任务已添加: {selectedTorrent.Title}");
                }
                else
                {
                    result.Success = true;
                    result.DownloadQueueSkipped = true;
                    result.MagnetLink = selectedTorrent.MagnetLink;
                    result.Message.AppendLine("未能自动加入下载队列，已显示磁力链接：");
                    result.Message.AppendLine(result.MagnetLink);
                }
            }
            catch (Exception ex)
            {
                result.Success = true;
                result.DownloadQueueSkipped = true;
                result.MagnetLink = selectedTorrent.MagnetLink;
                result.Message.AppendLine($"下载器异常，未能自动加入下载队列：{ex.Message}");
                result.Message.AppendLine("已显示磁力链接：");
                result.Message.AppendLine(result.MagnetLink);
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message.AppendLine($"处理失败: {ex.Message}");
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
                result.Message.AppendLine($"正在从本地缓存搜索 {javId}...");
                searchResult = await _cacheProvider.GetAsync(javId);
                
                if (searchResult != null && searchResult.Torrents.Count > 0)
                {
                    result.Message.AppendLine($"[本地缓存] 命中！缓存时间: {searchResult.CachedAt:yyyy-MM-dd HH:mm}");
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
                    result.Message.AppendLine("JavDB 服务异常：不支持远程搜索能力。");
                    return result;
                }

                result.Message.AppendLine($"正在从远端搜索 {javId}...");
                searchResult = await _javDbProvider.SearchAsync(javId);

                if (searchResult.Torrents.Count == 0)
                {
                    result.Success = false;
                    result.Message.AppendLine($"未找到 {javId} 的种子。");
                    return result;
                }

                // 保存到本地缓存
                if (_cacheProvider != null)
                {
                    await _cacheProvider.SaveAsync(searchResult);
                    result.Message.AppendLine("已缓存到本地数据库。");
                }
            }

            result.AvailableTorrents = _selectionService.GetSortedTorrents(searchResult.Torrents);
            result.Success = result.AvailableTorrents.Count > 0;
            result.Message.AppendLine(_selectionService.FormatTorrentInfo(searchResult.Torrents));

            // 添加详细信息到结果
            result.SearchResult = searchResult;

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message.AppendLine($"搜索失败: {ex.Message}");
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

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
    private readonly TorrentSelectionService _selectionService;
    private readonly LocalFileCheckService _localFileService;
    private readonly DownloadService _downloadService;

    public JavSearchService(
        IJavDbDataProvider javDbProvider,
        TorrentSelectionService selectionService,
        LocalFileCheckService localFileService,
        DownloadService downloadService)
    {
        _javDbProvider = javDbProvider;
        _selectionService = selectionService;
        _localFileService = localFileService;
        _downloadService = downloadService;
    }

    /// <summary>
    /// 执行完整的搜索和下载流程
    /// </summary>
    /// <param name="javId">番号</param>
    /// <param name="forceDownload">是否强制下载（忽略本地文件检查）</param>
    /// <returns>操作结果</returns>
    public async Task<JavSearchProcessResult> ProcessAsync(string javId, bool forceDownload = false)
    {
        var result = new JavSearchProcessResult { JavId = javId };

        try
        {
            // 步骤 1: 从 JavDB 搜索
            result.Message.AppendLine($"正在搜索 {javId}...");
            var searchResult = await _javDbProvider.SearchAsync(javId);

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
                result.Message.AppendLine("检查本地文件...");
                var localFiles = await _localFileService.CheckLocalFilesAsync(javId);

                if (localFiles.Count > 0)
                {
                    result.LocalFilesFound = true;
                    result.LocalFiles = localFiles;
                    result.Message.AppendLine(_localFileService.FormatLocalFileInfo(localFiles));
                    result.Message.AppendLine("本地文件已存在，请选择操作：");
                    result.Message.AppendLine("  1. 跳过下载");
                    result.Message.AppendLine("  2. 强制下载");
                    result.Success = true;
                    return result;
                }

                result.Message.AppendLine("本地文件不存在，开始下载...");
            }

            // 步骤 4: 执行下载
            var downloadSuccess = await _downloadService.AddDownloadAsync(selectedTorrent);

            if (downloadSuccess)
            {
                result.Success = true;
                result.Downloaded = true;
                result.Message.AppendLine($"下载任务已添加: {selectedTorrent.Title}");
            }
            else
            {
                result.Success = false;
                result.Message.AppendLine("添加下载任务失败。");
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
    public async Task<JavSearchProcessResult> ForceDownloadAsync(string javId)
    {
        return await ProcessAsync(javId, forceDownload: true);
    }

    /// <summary>
    /// 仅搜索不下载
    /// </summary>
    public async Task<JavSearchProcessResult> SearchOnlyAsync(string javId)
    {
        var result = new JavSearchProcessResult { JavId = javId };

        try
        {
            result.Message.AppendLine($"正在搜索 {javId}...");
            var searchResult = await _javDbProvider.SearchAsync(javId);

            if (searchResult.Torrents.Count == 0)
            {
                result.Success = false;
                result.Message.AppendLine($"未找到 {javId} 的种子。");
                return result;
            }

            result.Success = true;
            result.AvailableTorrents = _selectionService.GetSortedTorrents(searchResult.Torrents);
            result.Message.AppendLine(_selectionService.FormatTorrentInfo(searchResult.Torrents));

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message.AppendLine($"搜索失败: {ex.Message}");
            return result;
        }
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
    /// 选中的种子
    /// </summary>
    public TorrentInfo? SelectedTorrent { get; set; }

    /// <summary>
    /// 本地文件列表
    /// </summary>
    public List<LocalFileInfo> LocalFiles { get; set; } = new();

    /// <summary>
    /// 可用的种子列表
    /// </summary>
    public List<TorrentInfo> AvailableTorrents { get; set; } = new();

    /// <summary>
    /// 处理消息
    /// </summary>
    public StringBuilder Message { get; set; } = new();
}

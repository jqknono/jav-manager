using JavManager.Core.Models;
using JavManager.Utils;

namespace JavManager.Services;

/// <summary>
/// 种子选择服务
/// </summary>
public class TorrentSelectionService
{
    private readonly WeightCalculator _weightCalculator;

    public TorrentSelectionService(WeightCalculator weightCalculator)
    {
        _weightCalculator = weightCalculator;
    }

    /// <summary>
    /// 从种子列表中选择最佳的种子
    /// </summary>
    /// <param name="torrents">种子列表</param>
    /// <returns>最佳的种子，如果没有则返回 null</returns>
    public TorrentInfo? SelectBestTorrent(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
            return null;

        if (torrents.Count == 1)
            return torrents.First();

        // 使用权重计算器选择最佳种子
        return _weightCalculator.SelectBest(torrents);
    }

    /// <summary>
    /// 获取排序后的种子列表
    /// </summary>
    /// <param name="torrents">种子列表</param>
    /// <returns>按权重排序的种子列表</returns>
    public List<TorrentInfo> GetSortedTorrents(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
            return torrents;

        return _weightCalculator.CalculateAndSort(torrents);
    }

    /// <summary>
    /// 显示种子选择信息
    /// </summary>
    /// <param name="torrents">种子列表</param>
    /// <returns>格式化的种子信息</returns>
    public string FormatTorrentInfo(List<TorrentInfo> torrents)
    {
        var sorted = GetSortedTorrents(torrents);
        var sb = new System.Text.StringBuilder();

        sb.AppendLine($"找到 {torrents.Count} 个种子源:");
        sb.AppendLine();

        for (int i = 0; i < sorted.Count; i++)
        {
            var torrent = sorted[i];
            var markers = new List<string>();

            if (torrent.HasHd)
            {
                markers.Add("高清");
            }

            if (torrent.HasUncensoredMarker)
            {
                markers.Add("无码");
            }

            if (torrent.HasSubtitle)
            {
                markers.Add("字幕");
            }

            var markerStr = markers.Count > 0 ? $" [{string.Join(", ", markers)}]" : "";
            var sizeStr = FormatSize(torrent.Size);
            var scoreStr = $"(标记: {torrent.WeightScore:0})";

            sb.AppendLine($"  {i + 1}. {torrent.Title}{markerStr}");
            sb.AppendLine($"     大小: {sizeStr}, 做种: {torrent.Seeders}, 下载: {torrent.Leechers} {scoreStr}");
            sb.AppendLine();
        }

        var best = sorted.First();
        sb.AppendLine($"推荐: {best.Title} (标记: {best.WeightScore:0})");

        return sb.ToString();
    }

    /// <summary>
    /// 格式化文件大小
    /// </summary>
    private string FormatSize(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        double len = bytes;
        int order = 0;

        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }

        return $"{len:0.##} {sizes[order]}";
    }
}

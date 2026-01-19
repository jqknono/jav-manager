using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Models;

namespace JavManager.Utils;

/// <summary>
/// 种子权重计算器（简化版，基于标题标记）
/// </summary>
public class WeightCalculator
{
    public WeightCalculator(WeightsConfig config)
    {
    }

    /// <summary>
    /// 计算种子权重分数
    /// </summary>
    /// <param name="torrent">种子信息</param>
    /// <returns>权重分数</returns>
    public double Calculate(TorrentInfo torrent)
    {
        var score = 0;

        // 新规则：权重仅代表“标记数量”，用于排序与选择
        if (torrent.HasHd) score++;
        if (torrent.HasUncensoredMarker) score++;
        if (torrent.HasSubtitle) score++;

        torrent.WeightScore = score;
        return score;
    }

    /// <summary>
    /// 批量计算并排序种子
    /// </summary>
    /// <param name="torrents">种子列表</param>
    /// <returns>按权重排序的种子列表</returns>
    public List<TorrentInfo> CalculateAndSort(List<TorrentInfo> torrents)
    {
        foreach (var torrent in torrents)
        {
            Calculate(torrent);
        }

        return torrents
            .OrderByDescending(t => t.WeightScore) // 标记数量
            .ThenByDescending(t => t.Size)         // 同标记数下，优先更大
            .ToList();
    }

    /// <summary>
    /// 选择权重最高的种子
    /// </summary>
    /// <param name="torrents">种子列表</param>
    /// <returns>权重最高的种子，如果没有则返回 null</returns>
    public TorrentInfo? SelectBest(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
            return null;

        var sorted = CalculateAndSort(torrents);
        return sorted.First();
    }
}

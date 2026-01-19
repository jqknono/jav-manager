namespace JavManager.Core.Models;

/// <summary>
/// 种子信息模型
/// </summary>
public class TorrentInfo
{
    /// <summary>
    /// 种子标题
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 磁力链接
    /// </summary>
    public string MagnetLink { get; set; } = string.Empty;

    /// <summary>
    /// 种子文件 URL
    /// </summary>
    public string TorrentUrl { get; set; } = string.Empty;

    /// <summary>
    /// 文件大小（字节）
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// 是否有"无码"标记 (-UC, -U, -C)
    /// </summary>
    public bool HasUncensoredMarker { get; set; }

    /// <summary>
    /// 无码标记类型
    /// </summary>
    public UncensoredMarkerType UncensoredMarkerType { get; set; }

    /// <summary>
    /// 是否有字幕
    /// </summary>
    public bool HasSubtitle { get; set; }

    /// <summary>
    /// 是否为高清资源
    /// </summary>
    public bool HasHd { get; set; }

    /// <summary>
    /// 做种人数
    /// </summary>
    public int Seeders { get; set; }

    /// <summary>
    /// 下载人数
    /// </summary>
    public int Leechers { get; set; }

    /// <summary>
    /// 来源站点
    /// </summary>
    public string SourceSite { get; set; } = string.Empty;

    /// <summary>
    /// 权重分数
    /// </summary>
    public double WeightScore { get; set; }
}

/// <summary>
/// 无码标记类型
/// </summary>
public enum UncensoredMarkerType
{
    /// <summary>
    /// 无标记
    /// </summary>
    None,

    /// <summary>
    /// -UC (无码+字幕)
    /// </summary>
    UC,

    /// <summary>
    /// -U (无码)
    /// </summary>
    U,

    /// <summary>
    /// -C (字幕)
    /// </summary>
    C
}

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
    /// 是否有"无码"标记 (-UC, -U)
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
    /// 下载进度（0-1），仅对下载器来源有效
    /// </summary>
    public double? Progress { get; set; }

    /// <summary>
    /// 下载器状态，仅对下载器来源有效
    /// </summary>
    public string? State { get; set; }

    /// <summary>
    /// 下载速度（字节/秒），仅对下载器来源有效
    /// </summary>
    public long DlSpeed { get; set; }

    /// <summary>
    /// 剩余时间（秒），仅对下载器来源有效
    /// </summary>
    public long Eta { get; set; }

    /// <summary>
    /// 权重分数
    /// </summary>
    public double WeightScore { get; set; }

    /// <summary>
    /// 名称（用于下载列表显示）
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// 格式化的文件大小
    /// </summary>
    public string SizeDisplay
    {
        get
        {
            if (Size <= 0) return "-";
            if (Size >= 1024L * 1024 * 1024)
                return $"{Size / 1024.0 / 1024 / 1024:F2} GB";
            if (Size >= 1024 * 1024)
                return $"{Size / 1024.0 / 1024:F2} MB";
            return $"{Size / 1024.0:F2} KB";
        }
    }
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
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JavManager.DataProviders.LocalCache.Entities;

/// <summary>
/// 种子信息数据库实体
/// </summary>
[Table("Torrents")]
public class TorrentEntity
{
    /// <summary>
    /// 主键 ID
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    /// <summary>
    /// 关联的 JAV 信息 ID
    /// </summary>
    public int JavInfoId { get; set; }

    /// <summary>
    /// 种子标题
    /// </summary>
    [MaxLength(500)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 磁力链接
    /// </summary>
    [Required]
    public string MagnetLink { get; set; } = string.Empty;

    /// <summary>
    /// 磁力链接 Hash (用于去重)
    /// </summary>
    [MaxLength(64)]
    public string MagnetHash { get; set; } = string.Empty;

    /// <summary>
    /// 种子文件 URL
    /// </summary>
    [MaxLength(500)]
    public string TorrentUrl { get; set; } = string.Empty;

    /// <summary>
    /// 文件大小（字节）
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// 是否有"无码"标记
    /// </summary>
    public bool HasUncensoredMarker { get; set; }

    /// <summary>
    /// 无码标记类型 (0=None, 1=UC, 2=U)
    /// </summary>
    public int UncensoredMarkerType { get; set; }

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
    [MaxLength(50)]
    public string SourceSite { get; set; } = string.Empty;

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // 导航属性
    [ForeignKey(nameof(JavInfoId))]
    public virtual JavInfoEntity? JavInfo { get; set; }
}

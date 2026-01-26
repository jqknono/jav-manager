using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JavManager.DataProviders.LocalCache.Entities;

/// <summary>
/// JAV 信息数据库实体
/// </summary>
[Table("JavInfo")]
public class JavInfoEntity
{
    /// <summary>
    /// 主键 ID
    /// </summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    /// <summary>
    /// 番号 (如 XXX-123)，唯一索引
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string JavId { get; set; } = string.Empty;

    /// <summary>
    /// 标题
    /// </summary>
    [MaxLength(500)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 封面图 URL
    /// </summary>
    [MaxLength(500)]
    public string CoverUrl { get; set; } = string.Empty;

    /// <summary>
    /// 发布日期
    /// </summary>
    public DateTime? ReleaseDate { get; set; }

    /// <summary>
    /// 时长（分钟）
    /// </summary>
    public int Duration { get; set; }

    /// <summary>
    /// 导演
    /// </summary>
    [MaxLength(200)]
    public string Director { get; set; } = string.Empty;

    /// <summary>
    /// 制作商
    /// </summary>
    [MaxLength(200)]
    public string Maker { get; set; } = string.Empty;

    /// <summary>
    /// 发行商
    /// </summary>
    [MaxLength(200)]
    public string Publisher { get; set; } = string.Empty;

    /// <summary>
    /// 系列
    /// </summary>
    [MaxLength(200)]
    public string Series { get; set; } = string.Empty;

    /// <summary>
    /// 详情页 URL
    /// </summary>
    [MaxLength(500)]
    public string DetailUrl { get; set; } = string.Empty;

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 更新时间
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // 导航属性
    public virtual ICollection<JavActorEntity> Actors { get; set; } = new List<JavActorEntity>();
    public virtual ICollection<JavCategoryEntity> Categories { get; set; } = new List<JavCategoryEntity>();
    public virtual ICollection<TorrentEntity> Torrents { get; set; } = new List<TorrentEntity>();
}

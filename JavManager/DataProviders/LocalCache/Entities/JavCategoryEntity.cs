using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JavManager.DataProviders.LocalCache.Entities;

/// <summary>
/// 类别/标签数据库实体
/// </summary>
[Table("JavCategories")]
public class JavCategoryEntity
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
    /// 类别名称
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    // 导航属性
    [ForeignKey(nameof(JavInfoId))]
    public virtual JavInfoEntity? JavInfo { get; set; }
}

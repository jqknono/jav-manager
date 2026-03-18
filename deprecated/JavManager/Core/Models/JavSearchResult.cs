namespace JavManager.Core.Models;

/// <summary>
/// JavDB 搜索结果
/// </summary>
public class JavSearchResult
{
    /// <summary>
    /// 番号 (如 XXX-123)
    /// </summary>
    public string JavId { get; set; } = string.Empty;

    /// <summary>
    /// 标题
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 封面图 URL
    /// </summary>
    public string CoverUrl { get; set; } = string.Empty;

    /// <summary>
    /// 发布日期
    /// </summary>
    public DateTime ReleaseDate { get; set; }

    /// <summary>
    /// 时长（分钟）
    /// </summary>
    public int Duration { get; set; }

    /// <summary>
    /// 导演
    /// </summary>
    public string Director { get; set; } = string.Empty;

    /// <summary>
    /// 制作商
    /// </summary>
    public string Maker { get; set; } = string.Empty;

    /// <summary>
    /// 发行商
    /// </summary>
    public string Publisher { get; set; } = string.Empty;

    /// <summary>
    /// 系列
    /// </summary>
    public string Series { get; set; } = string.Empty;

    /// <summary>
    /// 演员列表
    /// </summary>
    public List<string> Actors { get; set; } = new();

    /// <summary>
    /// 类别/标签列表
    /// </summary>
    public List<string> Categories { get; set; } = new();

    /// <summary>
    /// 关联的种子列表
    /// </summary>
    public List<TorrentInfo> Torrents { get; set; } = new();

    /// <summary>
    /// 详情页 URL
    /// </summary>
    public string DetailUrl { get; set; } = string.Empty;

    /// <summary>
    /// 数据来源（Local/Remote）
    /// </summary>
    public string DataSource { get; set; } = "Remote";

    /// <summary>
    /// 缓存时间
    /// </summary>
    public DateTime? CachedAt { get; set; }
}

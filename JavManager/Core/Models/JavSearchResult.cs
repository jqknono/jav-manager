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
    /// 关联的种子列表
    /// </summary>
    public List<TorrentInfo> Torrents { get; set; } = new();

    /// <summary>
    /// 详情页 URL
    /// </summary>
    public string DetailUrl { get; set; } = string.Empty;
}

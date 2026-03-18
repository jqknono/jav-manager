using JavManager.Core.Models;

namespace JavManager.Core.Interfaces;

/// <summary>
/// 本地缓存数据提供者接口
/// </summary>
public interface IJavLocalCacheProvider
{
    /// <summary>
    /// 从本地缓存获取 JAV 信息
    /// </summary>
    /// <param name="javId">番号</param>
    /// <returns>搜索结果，若未找到则返回 null</returns>
    Task<JavSearchResult?> GetAsync(string javId);

    /// <summary>
    /// 保存 JAV 信息到本地缓存
    /// </summary>
    /// <param name="result">搜索结果</param>
    Task SaveAsync(JavSearchResult result);

    /// <summary>
    /// 更新 JAV 信息的种子列表
    /// </summary>
    /// <param name="javId">番号</param>
    /// <param name="torrents">种子列表</param>
    Task UpdateTorrentsAsync(string javId, List<TorrentInfo> torrents);

    /// <summary>
    /// 检查缓存是否存在
    /// </summary>
    /// <param name="javId">番号</param>
    /// <returns>是否存在缓存</returns>
    Task<bool> ExistsAsync(string javId);

    /// <summary>
    /// 删除缓存
    /// </summary>
    /// <param name="javId">番号</param>
    Task DeleteAsync(string javId);

    /// <summary>
    /// 获取缓存统计信息
    /// </summary>
    Task<CacheStatistics> GetStatisticsAsync();

    /// <summary>
    /// 初始化数据库（创建表）
    /// </summary>
    Task InitializeAsync();
}

/// <summary>
/// 缓存统计信息
/// </summary>
public class CacheStatistics
{
    /// <summary>
    /// 缓存的 JAV 数量
    /// </summary>
    public int TotalJavCount { get; set; }

    /// <summary>
    /// 缓存的种子数量
    /// </summary>
    public int TotalTorrentCount { get; set; }

    /// <summary>
    /// 数据库文件大小（字节）
    /// </summary>
    public long DatabaseSizeBytes { get; set; }

    /// <summary>
    /// 最后更新时间
    /// </summary>
    public DateTime? LastUpdatedAt { get; set; }
}

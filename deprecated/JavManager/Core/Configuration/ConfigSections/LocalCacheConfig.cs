namespace JavManager.Core.Configuration.ConfigSections;

/// <summary>
/// 本地缓存配置
/// </summary>
public class LocalCacheConfig
{
    /// <summary>
    /// 是否启用本地缓存
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// 数据库文件路径（为空则使用默认路径）
    /// </summary>
    public string DatabasePath { get; set; } = string.Empty;

    /// <summary>
    /// 缓存过期时间（天），0 表示永不过期
    /// </summary>
    public int CacheExpirationDays { get; set; } = 0;
}

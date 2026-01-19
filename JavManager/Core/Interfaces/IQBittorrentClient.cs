using JavManager.Core.Models;

namespace JavManager.Core.Interfaces;

/// <summary>
/// qBittorrent 客户端接口
/// </summary>
public interface IQBittorrentClient
{
    /// <summary>
    /// 登录认证
    /// </summary>
    Task LoginAsync();

    /// <summary>
    /// 添加种子（磁力链接）
    /// </summary>
    /// <param name="magnetLink">磁力链接</param>
    /// <param name="savePath">保存路径</param>
    /// <param name="category">分类</param>
    /// <param name="tags">标签</param>
    /// <returns>是否成功</returns>
    Task<bool> AddTorrentAsync(string magnetLink, string? savePath = null, string? category = null, string? tags = null);

    /// <summary>
    /// 添加种子（URL 或 文件）
    /// </summary>
    /// <param name="urls">种子 URL 列表</param>
    /// <param name="savePath">保存路径</param>
    /// <param name="category">分类</param>
    /// <param name="tags">标签</param>
    /// <returns>是否成功</returns>
    Task<bool> AddTorrentFromUrlAsync(List<string> urls, string? savePath = null, string? category = null, string? tags = null);

    /// <summary>
    /// 获取种子列表
    /// </summary>
    Task<List<TorrentInfo>> GetTorrentsAsync();

    /// <summary>
    /// 暂停种子
    /// </summary>
    /// <param name="hashes">种子哈希列表</param>
    Task PauseAsync(List<string> hashes);

    /// <summary>
    /// 恢复种子
    /// </summary>
    /// <param name="hashes">种子哈希列表</param>
    Task ResumeAsync(List<string> hashes);

    /// <summary>
    /// 删除种子
    /// </summary>
    /// <param name="hashes">种子哈希列表</param>
    /// <param name="deleteFiles">是否删除文件</param>
    Task DeleteAsync(List<string> hashes, bool deleteFiles = false);
}

using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;

namespace JavManager.Services;

/// <summary>
/// 下载服务
/// </summary>
public class DownloadService
{
    private readonly IQBittorrentClient _qBittorrentClient;
    private readonly DownloadConfig _config;

    public DownloadService(IQBittorrentClient qBittorrentClient, DownloadConfig config)
    {
        _qBittorrentClient = qBittorrentClient;
        _config = config;
    }

    private static string? NormalizeExistingDirectoryPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return null;

        var expanded = Environment.ExpandEnvironmentVariables(path.Trim());

        try
        {
            if (!Path.IsPathRooted(expanded))
                return null;

            var fullPath = Path.GetFullPath(expanded);
            return Directory.Exists(fullPath) ? fullPath : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// 添加下载任务
    /// </summary>
    /// <param name="torrent">种子信息</param>
    /// <param name="savePath">保存路径（可选）</param>
    /// <param name="category">分类（可选）</param>
    /// <param name="tags">标签（可选）</param>
    /// <returns>是否成功</returns>
    public async Task<bool> AddDownloadAsync(
        TorrentInfo torrent,
        string? savePath = null,
        string? category = null,
        string? tags = null)
    {
        try
        {
            // 使用配置的默认值
            var candidateSavePath = savePath ?? _config.DefaultSavePath;
            savePath = NormalizeExistingDirectoryPath(candidateSavePath);
            category ??= _config.DefaultCategory;
            tags ??= _config.DefaultTags;

            // 添加种子
            var success = await _qBittorrentClient.AddTorrentAsync(
                torrent.MagnetLink,
                savePath,
                category,
                tags
            );

            return success;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to add download: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 获取当前下载列表
    /// </summary>
    public async Task<List<TorrentInfo>> GetDownloadsAsync()
    {
        return await _qBittorrentClient.GetTorrentsAsync();
    }

    /// <summary>
    /// 暂停下载
    /// </summary>
    /// <param name="hashes">种子哈希列表</param>
    public async Task PauseAsync(List<string> hashes)
    {
        await _qBittorrentClient.PauseAsync(hashes);
    }

    /// <summary>
    /// 恢复下载
    /// </summary>
    /// <param name="hashes">种子哈希列表</param>
    public async Task ResumeAsync(List<string> hashes)
    {
        await _qBittorrentClient.ResumeAsync(hashes);
    }

    /// <summary>
    /// 删除下载
    /// </summary>
    /// <param name="hashes">种子哈希列表</param>
    /// <param name="deleteFiles">是否删除文件</param>
    public async Task DeleteAsync(List<string> hashes, bool deleteFiles = false)
    {
        await _qBittorrentClient.DeleteAsync(hashes, deleteFiles);
    }
}

using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Utils;

namespace JavManager.Services;

/// <summary>
/// 本地文件检查服务
/// </summary>
public class LocalFileCheckService
{
    private readonly IEverythingSearchProvider _searchProvider;
    private readonly TorrentNameParser _nameParser;

    public LocalFileCheckService(IEverythingSearchProvider searchProvider, TorrentNameParser nameParser)
    {
        _searchProvider = searchProvider;
        _nameParser = nameParser;
    }

    /// <summary>
    /// 检查本地是否存在文件
    /// </summary>
    /// <param name="javId">番号</param>
    /// <returns>本地文件列表</returns>
    public async Task<List<LocalFileInfo>> CheckLocalFilesAsync(string javId)
    {
        try
        {
            // 标准化番号
            var normalizedId = _nameParser.NormalizeJavId(javId);

            // 使用 Everything 搜索
            var results = await _searchProvider.SearchAsync(normalizedId);

            // 过滤视频文件
            var videoFiles = results.Where(f => f.FileType == FileType.Video).ToList();

            return videoFiles;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Local file check failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 检查文件是否存在
    /// </summary>
    /// <param name="javId">番号</param>
    /// <returns>是否存在</returns>
    public async Task<bool> FileExistsAsync(string javId)
    {
        var files = await CheckLocalFilesAsync(javId);
        return files.Count > 0;
    }

    /// <summary>
    /// 格式化本地文件信息
    /// </summary>
    /// <param name="files">文件列表</param>
    /// <returns>格式化的文件信息</returns>
    public string FormatLocalFileInfo(List<LocalFileInfo> files)
    {
        if (files.Count == 0)
            return "未找到本地文件。";

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"找到 {files.Count} 个本地文件:");
        sb.AppendLine();

        for (int i = 0; i < files.Count; i++)
        {
            var file = files[i];
            var sizeStr = FormatSize(file.Size);
            var dateStr = file.ModifiedDate.ToString("yyyy-MM-dd HH:mm");

            sb.AppendLine($"  {i + 1}. {file.FileName}");
            sb.AppendLine($"     路径: {file.FullPath}");
            sb.AppendLine($"     大小: {sizeStr}, 修改时间: {dateStr}");
            sb.AppendLine();
        }

        return sb.ToString();
    }

    /// <summary>
    /// 格式化文件大小
    /// </summary>
    private string FormatSize(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        double len = bytes;
        int order = 0;

        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }

        return $"{len:0.##} {sizes[order]}";
    }
}

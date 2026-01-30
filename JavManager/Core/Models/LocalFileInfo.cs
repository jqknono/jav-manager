namespace JavManager.Core.Models;

/// <summary>
/// 本地文件搜索结果
/// </summary>
public class LocalFileInfo
{
    /// <summary>
    /// 文件名
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// 完整路径
    /// </summary>
    public string FullPath { get; set; } = string.Empty;

    /// <summary>
    /// 文件大小（字节）
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// 修改日期
    /// </summary>
    public DateTime ModifiedDate { get; set; }

    /// <summary>
    /// 文件类型
    /// </summary>
    public FileType FileType { get; set; }

    /// <summary>
    /// 格式化的文件大小
    /// </summary>
    public string SizeDisplay
    {
        get
        {
            if (Size <= 0) return "-";
            if (Size >= 1024L * 1024 * 1024)
                return $"{Size / 1024.0 / 1024 / 1024:F2} GB";
            if (Size >= 1024 * 1024)
                return $"{Size / 1024.0 / 1024:F2} MB";
            return $"{Size / 1024.0:F2} KB";
        }
    }
}

/// <summary>
/// 文件类型
/// </summary>
public enum FileType
{
    /// <summary>
    /// 视频文件
    /// </summary>
    Video,

    /// <summary>
    /// 文件夹
    /// </summary>
    Folder,

    /// <summary>
    /// 种子文件
    /// </summary>
    Torrent
}

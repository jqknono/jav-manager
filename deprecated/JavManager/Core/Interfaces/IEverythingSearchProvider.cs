using JavManager.Core.Models;

namespace JavManager.Core.Interfaces;

/// <summary>
/// Everything 搜索提供者接口
/// </summary>
public interface IEverythingSearchProvider
{
    /// <summary>
    /// 搜索本地文件
    /// </summary>
    /// <param name="searchTerm">搜索词 (如 XXX-123)</param>
    /// <returns>本地文件列表</returns>
    Task<List<LocalFileInfo>> SearchAsync(string searchTerm);

    /// <summary>
    /// 检查文件是否存在
    /// </summary>
    /// <param name="javId">番号</param>
    /// <returns>是否存在</returns>
    Task<bool> FileExistsAsync(string javId);
}

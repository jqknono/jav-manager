using JavManager.Core.Models;

namespace JavManager.Core.Interfaces;

/// <summary>
/// JavDB 数据提供者接口
/// </summary>
public interface IJavDbDataProvider
{
    /// <summary>
    /// 搜索番号并获取种子列表
    /// </summary>
    /// <param name="javId">番号 (如 XXX-123)</param>
    /// <returns>搜索结果</returns>
    Task<JavSearchResult> SearchAsync(string javId);

    /// <summary>
    /// 获取视频详情
    /// </summary>
    /// <param name="detailUrl">详情页 URL</param>
    /// <returns>视频详情和种子列表</returns>
    Task<JavSearchResult> GetDetailAsync(string detailUrl);
}

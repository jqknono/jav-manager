namespace JavManager.Core.Models;

/// <summary>
/// 用户选择选项
/// </summary>
public class UserSelectionOption
{
    /// <summary>
    /// 选项索引
    /// </summary>
    public int Index { get; set; }

    /// <summary>
    /// 选项描述
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 关联数据
    /// </summary>
    public object? Data { get; set; }
}

/// <summary>
/// 用户选择结果
/// </summary>
public class UserSelectionResult
{
    /// <summary>
    /// 用户选择的索引
    /// </summary>
    public int SelectedIndex { get; set; }

    /// <summary>
    /// 是否取消
    /// </summary>
    public bool IsCancelled { get; set; }

    /// <summary>
    /// 是否强制下载
    /// </summary>
    public bool ForceDownload { get; set; }
}

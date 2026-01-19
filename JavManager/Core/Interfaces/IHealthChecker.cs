namespace JavManager.Core.Interfaces;

/// <summary>
/// 服务健康检查结果
/// </summary>
public class HealthCheckResult
{
    public string ServiceName { get; set; } = string.Empty;
    public bool IsHealthy { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Url { get; set; }
}

/// <summary>
/// 服务健康检查接口
/// </summary>
public interface IHealthChecker
{
    /// <summary>
    /// 服务名称
    /// </summary>
    string ServiceName { get; }

    /// <summary>
    /// 检查服务健康状态
    /// </summary>
    Task<HealthCheckResult> CheckHealthAsync();
}

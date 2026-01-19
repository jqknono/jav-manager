using JavManager.Core.Interfaces;

namespace JavManager.Services;

/// <summary>
/// 健康检查编排服务
/// </summary>
public class HealthCheckService
{
    private readonly IEnumerable<IHealthChecker> _healthCheckers;

    public HealthCheckService(IEnumerable<IHealthChecker> healthCheckers)
    {
        _healthCheckers = healthCheckers;
    }

    /// <summary>
    /// 检查所有服务健康状态
    /// </summary>
    public async Task<List<HealthCheckResult>> CheckAllAsync()
    {
        var results = new List<HealthCheckResult>();

        foreach (var checker in _healthCheckers)
        {
            try
            {
                var result = await checker.CheckHealthAsync();
                results.Add(result);
            }
            catch (Exception ex)
            {
                results.Add(new HealthCheckResult
                {
                    ServiceName = checker.ServiceName,
                    IsHealthy = false,
                    Message = $"健康检查异常: {ex.Message}"
                });
            }
        }

        return results;
    }

    /// <summary>
    /// 获取所有不健康的服务
    /// </summary>
    public async Task<List<HealthCheckResult>> GetUnhealthyServicesAsync()
    {
        var allResults = await CheckAllAsync();
        return allResults.Where(r => !r.IsHealthy).ToList();
    }
}

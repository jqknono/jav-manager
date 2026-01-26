using JavManager.Core.Interfaces;
using JavManager.Localization;

namespace JavManager.Services;

/// <summary>
/// 健康检查编排服务
/// </summary>
public class HealthCheckService
{
    private readonly IEnumerable<IHealthChecker> _healthCheckers;
    private readonly LocalizationService _loc;

    public HealthCheckService(IEnumerable<IHealthChecker> healthCheckers, LocalizationService localizationService)
    {
        _healthCheckers = healthCheckers;
        _loc = localizationService;
    }

    /// <summary>
    /// 检查所有服务健康状态
    /// </summary>
    public async Task<List<HealthCheckResult>> CheckAllAsync()
    {
        var tasks = _healthCheckers
            .Select(async checker =>
            {
                try
                {
                    return await checker.CheckHealthAsync();
                }
                catch (Exception ex)
                {
                    return new HealthCheckResult
                    {
                        ServiceName = checker.ServiceName,
                        IsHealthy = false,
                        Message = _loc.GetFormat(L.HealthCheckException, ex.Message)
                    };
                }
            })
            .ToArray();

        var results = await Task.WhenAll(tasks);
        return results.ToList();
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

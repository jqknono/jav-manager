using JavManager.Core.Models;

namespace JavManager.Services;

public interface IJavInfoTelemetryClient
{
    void TryReport(JavSearchResult result);
}

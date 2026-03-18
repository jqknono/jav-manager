using JavManager.Core.Models;

namespace JavManager.Services;

public sealed class NullJavInfoTelemetryClient : IJavInfoTelemetryClient
{
    public void TryReport(JavSearchResult result)
    {
        // no-op
    }
}

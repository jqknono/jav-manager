using System.Threading;
using System.Threading.Tasks;

namespace JavManager.Core.Interfaces;

public interface IJavDbHttpFetcher
{
    Task<(int StatusCode, string Body, string? Error)> GetAsync(
        string url,
        string? referer,
        string? cookieHeader,
        int timeoutMs,
        CancellationToken cancellationToken = default);
}


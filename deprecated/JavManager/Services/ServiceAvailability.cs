using JavManager.Core.Interfaces;

namespace JavManager.Services;

public sealed class ServiceAvailability
{
    private readonly object _lock = new();

    public bool EverythingKnown { get; private set; }
    public bool EverythingHealthy { get; private set; }

    public bool QBittorrentKnown { get; private set; }
    public bool QBittorrentHealthy { get; private set; }

    public bool JavDbKnown { get; private set; }
    public bool JavDbHealthy { get; private set; }

    public bool LocalDedupAvailable => !EverythingKnown || EverythingHealthy;
    public bool DownloadQueueAvailable => !QBittorrentKnown || QBittorrentHealthy;
    public bool RemoteSearchAvailable => !JavDbKnown || JavDbHealthy;

    public void UpdateFrom(IEnumerable<HealthCheckResult> results)
    {
        if (results == null)
            return;

        lock (_lock)
        {
            var everything = results.FirstOrDefault(r => r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase));
            if (everything != null)
            {
                EverythingKnown = true;
                EverythingHealthy = everything.IsHealthy;
            }

            var qb = results.FirstOrDefault(r => r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase));
            if (qb != null)
            {
                QBittorrentKnown = true;
                QBittorrentHealthy = qb.IsHealthy;
            }

            var javDb = results.FirstOrDefault(r => r.ServiceName.Contains("JavDB", StringComparison.OrdinalIgnoreCase));
            if (javDb != null)
            {
                JavDbKnown = true;
                JavDbHealthy = javDb.IsHealthy;
            }
        }
    }
}


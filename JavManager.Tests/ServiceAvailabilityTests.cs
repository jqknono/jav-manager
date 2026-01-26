using JavManager.Core.Interfaces;
using JavManager.Services;
using Xunit;

namespace JavManager.Tests;

public class ServiceAvailabilityTests
{
    [Fact]
    public void UpdateFrom_SetsKnownAndHealthFlags()
    {
        var availability = new ServiceAvailability();

        availability.UpdateFrom(new List<HealthCheckResult>
        {
            new() { ServiceName = "Everything (本地搜索)", IsHealthy = false, Message = "down" },
            new() { ServiceName = "qBittorrent (下载器)", IsHealthy = true, Message = "ok" },
            new() { ServiceName = "JavDB (远程数据库)", IsHealthy = false, Message = "down" },
        });

        Assert.True(availability.EverythingKnown);
        Assert.False(availability.EverythingHealthy);

        Assert.True(availability.QBittorrentKnown);
        Assert.True(availability.QBittorrentHealthy);

        Assert.True(availability.JavDbKnown);
        Assert.False(availability.JavDbHealthy);

        Assert.False(availability.LocalDedupAvailable);
        Assert.True(availability.DownloadQueueAvailable);
        Assert.False(availability.RemoteSearchAvailable);
    }
}


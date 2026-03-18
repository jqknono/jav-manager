using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Localization;
using JavManager.Services;
using JavManager.Utils;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace JavManager.Tests;

public class JavSearchServiceAvailabilityTests
{
    private sealed class DummyJavDbProvider : IJavDbDataProvider
    {
        public Task<JavSearchResult> SearchAsync(string javId) => throw new NotImplementedException();
        public Task<List<JavSearchResult>> SearchCandidatesAsync(string javId) => throw new NotImplementedException();
        public Task<JavSearchResult> GetDetailAsync(string detailUrl) => throw new NotImplementedException();
    }

    private sealed class CountingEverythingProvider : IEverythingSearchProvider
    {
        private readonly Func<string, Task<List<LocalFileInfo>>> _search;
        public int SearchCallCount { get; private set; }

        public CountingEverythingProvider(Func<string, Task<List<LocalFileInfo>>> search)
        {
            _search = search;
        }

        public async Task<List<LocalFileInfo>> SearchAsync(string searchTerm)
        {
            SearchCallCount++;
            return await _search(searchTerm);
        }

        public Task<bool> FileExistsAsync(string javId) => throw new NotImplementedException();
    }

    private sealed class CountingQbittorrentClient : IQBittorrentClient
    {
        private readonly Func<string, Task<bool>> _addTorrent;

        public CountingQbittorrentClient(Func<string, Task<bool>> addTorrent)
        {
            _addTorrent = addTorrent;
        }

        public int AddTorrentCallCount { get; private set; }

        public Task LoginAsync() => Task.CompletedTask;

        public async Task<bool> AddTorrentAsync(string magnetLink, string? savePath = null, string? category = null, string? tags = null)
        {
            AddTorrentCallCount++;
            return await _addTorrent(magnetLink);
        }

        public Task<bool> AddTorrentFromUrlAsync(List<string> urls, string? savePath = null, string? category = null, string? tags = null)
            => throw new NotImplementedException();

        public Task<List<TorrentInfo>> GetTorrentsAsync() => throw new NotImplementedException();
        public Task PauseAsync(List<string> hashes) => throw new NotImplementedException();
        public Task ResumeAsync(List<string> hashes) => throw new NotImplementedException();
        public Task DeleteAsync(List<string> hashes, bool deleteFiles = false) => throw new NotImplementedException();
    }

    private static TorrentSelectionService CreateSelectionService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Console:HideOtherTorrents"] = "false"
            })
            .Build();

        return new TorrentSelectionService(new WeightCalculator(), config);
    }

    [Fact]
    public async Task ProcessSelectedTorrentAsync_SkipsLocalDedup_WhenEverythingUnhealthy()
    {
        var availability = new ServiceAvailability();
        availability.UpdateFrom(new List<HealthCheckResult>
        {
            new() { ServiceName = "Everything (本地搜索)", IsHealthy = false },
        });

        var everything = new CountingEverythingProvider(_ => throw new InvalidOperationException("should not be called"));
        var localFileService = new LocalFileCheckService(everything, new TorrentNameParser());

        var qb = new CountingQbittorrentClient(_ => Task.FromResult(true));
        var downloadService = new DownloadService(qb, new DownloadConfig());

        var service = new JavSearchService(
            new DummyJavDbProvider(),
            CreateSelectionService(),
            localFileService,
            downloadService,
            availability,
            new LocalizationService(),
            new NullJavInfoTelemetryClient());

        var torrent = new TorrentInfo { Title = "ABC-123", MagnetLink = "magnet:?xt=urn:btih:abc" };
        var result = await service.ProcessSelectedTorrentAsync("ABC-123", torrent, forceDownload: false);

        Assert.True(result.Success);
        Assert.True(result.LocalDedupSkipped);
        Assert.Equal(0, everything.SearchCallCount);
        Assert.True(result.Downloaded);
    }

    [Fact]
    public async Task ProcessSelectedTorrentAsync_ShowsMagnetAndSkipsQueue_WhenQbittorrentUnhealthy()
    {
        var availability = new ServiceAvailability();
        availability.UpdateFrom(new List<HealthCheckResult>
        {
            new() { ServiceName = "qBittorrent (下载器)", IsHealthy = false },
        });

        var everything = new CountingEverythingProvider(_ => Task.FromResult(new List<LocalFileInfo>()));
        var localFileService = new LocalFileCheckService(everything, new TorrentNameParser());

        var qb = new CountingQbittorrentClient(_ => Task.FromResult(true));
        var downloadService = new DownloadService(qb, new DownloadConfig());

        var service = new JavSearchService(
            new DummyJavDbProvider(),
            CreateSelectionService(),
            localFileService,
            downloadService,
            availability,
            new LocalizationService(),
            new NullJavInfoTelemetryClient());

        var torrent = new TorrentInfo { Title = "ABC-123", MagnetLink = "magnet:?xt=urn:btih:abc" };
        var result = await service.ProcessSelectedTorrentAsync("ABC-123", torrent, forceDownload: false);

        Assert.True(result.Success);
        Assert.True(result.DownloadQueueSkipped);
        Assert.Equal("magnet:?xt=urn:btih:abc", result.MagnetLink);
        Assert.False(result.Downloaded);
        Assert.Equal(0, qb.AddTorrentCallCount);
    }
}

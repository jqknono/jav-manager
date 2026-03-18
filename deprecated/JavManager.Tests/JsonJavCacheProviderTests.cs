using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Models;
using JavManager.DataProviders.LocalCache;
using Xunit;

namespace JavManager.Tests;

public class JsonJavCacheProviderTests
{
    [Fact]
    public async Task SaveAsync_PersistsAndLoadsResult()
    {
        var cachePath = Path.Combine(Path.GetTempPath(), $"javmanager_cache_{Guid.NewGuid():N}.json");
        try
        {
            var config = new LocalCacheConfig
            {
                Enabled = true,
                DatabasePath = cachePath,
                CacheExpirationDays = 0
            };

            var provider = new JsonJavCacheProvider(config);
            await provider.InitializeAsync();

            var result = new JavSearchResult
            {
                JavId = "ABC-123",
                Title = "Test Title",
                CoverUrl = "https://example.test/cover.jpg",
                ReleaseDate = new DateTime(2020, 1, 2),
                Duration = 120,
                Director = "Test Director",
                Maker = "Test Maker",
                Publisher = "Test Publisher",
                Series = "Test Series",
                DetailUrl = "https://example.test/detail",
                Actors = new List<string> { "Actor A" },
                Categories = new List<string> { "Category A" },
                Torrents = new List<TorrentInfo>
                {
                    new()
                    {
                        Title = "Test Torrent",
                        MagnetLink = "magnet:?xt=urn:btih:0123456789ABCDEF0123456789ABCDEF01234567",
                        TorrentUrl = "https://example.test/torrent",
                        Size = 123,
                        HasUncensoredMarker = false,
                        UncensoredMarkerType = UncensoredMarkerType.None,
                        HasSubtitle = false,
                        HasHd = true,
                        Seeders = 10,
                        Leechers = 5,
                        SourceSite = "Test"
                    }
                }
            };

            await provider.SaveAsync(result);

            var loaded = await provider.GetAsync("abc123");

            Assert.NotNull(loaded);
            Assert.Equal("ABC-123", loaded!.JavId);
            Assert.Equal("Local", loaded.DataSource);
            Assert.Equal("Test Title", loaded.Title);
            Assert.Single(loaded.Actors);
            Assert.Single(loaded.Categories);
            Assert.Single(loaded.Torrents);
            Assert.NotNull(loaded.CachedAt);

            var stats = await provider.GetStatisticsAsync();
            Assert.Equal(1, stats.TotalJavCount);
            Assert.Equal(1, stats.TotalTorrentCount);
            Assert.True(stats.DatabaseSizeBytes > 0);
            Assert.NotNull(stats.LastUpdatedAt);
        }
        finally
        {
            if (File.Exists(cachePath))
                File.Delete(cachePath);
        }
    }
}


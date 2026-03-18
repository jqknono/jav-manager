using System.Net.Http;
using System.Net;
using System.Reflection;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.DataProviders.JavDb;
using JavManager.Localization;
using JavManager.Utils;
using Moq;
using Xunit;

namespace JavManager.Tests.DataProviders.JavDb;

public class JavDbWebScraperHttpClientTests
{
    [Fact]
    public void Constructor_SetsHttp11AndDoesNotUpgradeToHttp2()
    {
        var config = new JavDbConfig();
        var mockFetcher = new Mock<IJavDbHttpFetcher>();
        var scraper = new JavDbWebScraper(config, new TorrentNameParser(), new LocalizationService(), mockFetcher.Object);

        var httpClient = GetHttpClient(scraper);

        Assert.Equal(HttpVersion.Version11, httpClient.DefaultRequestVersion);
        Assert.Equal(HttpVersionPolicy.RequestVersionOrLower, httpClient.DefaultVersionPolicy);
    }

    [Fact]
    public void Constructor_WhenPlatformFeaturesUnavailable_DoesNotThrow()
    {
        var config = new JavDbConfig();
        var mockFetcher = new Mock<IJavDbHttpFetcher>();

        var ex = Record.Exception(() => _ = new JavDbWebScraper(config, new TorrentNameParser(), new LocalizationService(), mockFetcher.Object));

        Assert.Null(ex);
    }

    private static HttpClient GetHttpClient(JavDbWebScraper scraper)
    {
        var field = typeof(JavDbWebScraper).GetField("_httpClient", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(field);

        return (HttpClient)field!.GetValue(scraper)!;
    }
}


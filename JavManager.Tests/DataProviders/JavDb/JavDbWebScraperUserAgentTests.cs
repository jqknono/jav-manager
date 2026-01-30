using System.Reflection;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.DataProviders.JavDb;
using JavManager.Localization;
using JavManager.Utils;
using Moq;
using Xunit;

namespace JavManager.Tests.DataProviders.JavDb;

public class JavDbWebScraperUserAgentTests
{
    private const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";

    [Fact]
    public void Constructor_WhenUserAgentSet_UsesConfiguredUserAgentFirst()
    {
        var config = new JavDbConfig
        {
            UserAgent = "Test UA"
        };
        var mockFetcher = new Mock<IJavDbHttpFetcher>();
        var scraper = new JavDbWebScraper(config, new TorrentNameParser(), new LocalizationService(), mockFetcher.Object);

        var userAgents = GetUserAgents(scraper);

        Assert.True(userAgents.Count >= 1);
        Assert.Equal("Test UA", userAgents[0]);
    }

    [Fact]
    public void Constructor_WhenNoUserAgentSet_UsesDefaultUserAgents()
    {
        var config = new JavDbConfig();
        var mockFetcher = new Mock<IJavDbHttpFetcher>();
        var scraper = new JavDbWebScraper(config, new TorrentNameParser(), new LocalizationService(), mockFetcher.Object);

        var userAgents = GetUserAgents(scraper);

        Assert.True(userAgents.Count >= 1);
        Assert.Equal(DefaultUserAgent, userAgents[0]);
    }

    private static List<string> GetUserAgents(JavDbWebScraper scraper)
    {
        var field = typeof(JavDbWebScraper).GetField("_userAgents", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(field);

        return (List<string>)field!.GetValue(scraper)!;
    }
}

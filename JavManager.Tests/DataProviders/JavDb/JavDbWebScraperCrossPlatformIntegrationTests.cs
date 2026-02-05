using System.Runtime.InteropServices;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.DataProviders.JavDb;
using JavManager.Localization;
using JavManager.Utils;
using Xunit;

namespace JavManager.Tests.DataProviders.JavDb;

/// <summary>
/// 跨平台集成测试 - 验证 curl-impersonate 在各个平台下能否成功搜索 MIAA-710
/// </summary>
[Trait("Category", "Integration")]
[Trait("Category", "CrossPlatform")]
public class JavDbWebScraperCrossPlatformIntegrationTests : IDisposable
{
    private const string TestJavId = "MIAA-710";
    private const int TestTimeoutMs = 60000;

    private readonly JavDbWebScraper _scraper;
    private readonly JavDbConfig _config;

    public JavDbWebScraperCrossPlatformIntegrationTests()
    {
        _config = CreateTestConfig();
        var curlFetcher = new CurlImpersonateHttpFetcher(_config);
        var nameParser = new TorrentNameParser();
        var loc = new LocalizationService();
        _scraper = new JavDbWebScraper(_config, nameParser, loc, curlFetcher);
    }

    public void Dispose() => _scraper?.Dispose();

    #region 辅助方法

    private static JavDbConfig CreateTestConfig()
    {
        return new JavDbConfig
        {
            BaseUrl = "https://javdb.com",
            RequestTimeout = TestTimeoutMs,
            CurlImpersonate = new JavDbConfig.CurlImpersonateConfig
            {
                Enabled = true,
                Target = "chrome116",
                DefaultHeaders = true
            }
        };
    }

    private static PlatformInfo GetPlatformInfo()
    {
        var arch = RuntimeInformation.ProcessArchitecture;
        string rid;
        string osName;

        if (OperatingSystem.IsWindows())
        {
            osName = "Windows";
            rid = arch switch
            {
                Architecture.X64 => "win-x64",
                Architecture.X86 => "win-x86",
                Architecture.Arm64 => "win-arm64",
                _ => "win-x64"
            };
        }
        else if (OperatingSystem.IsLinux())
        {
            osName = "Linux";
            rid = arch switch
            {
                Architecture.X64 => "linux-x64",
                Architecture.Arm64 => "linux-arm64",
                _ => "linux-x64"
            };
        }
        else if (OperatingSystem.IsMacOS())
        {
            osName = "macOS";
            rid = arch switch
            {
                Architecture.X64 => "osx-x64",
                Architecture.Arm64 => "osx-arm64",
                _ => "osx-x64"
            };
        }
        else
        {
            osName = "Unknown";
            rid = "unknown";
        }

        return new PlatformInfo(osName, rid, arch);
    }

    private static void AssertValidJavSearchResult(JavSearchResult result, string expectedJavId)
    {
        Assert.NotNull(result);
        Assert.Equal(expectedJavId, result.JavId, ignoreCase: true);
        Assert.NotEmpty(result.Title);
        Assert.NotEmpty(result.DetailUrl);
        Assert.True(Uri.IsWellFormedUriString(result.DetailUrl, UriKind.Absolute),
            $"DetailUrl is not a valid URI: {result.DetailUrl}");
    }

    private static void AssertHasValidTorrents(JavSearchResult result)
    {
        Assert.NotNull(result.Torrents);
        Assert.True(result.Torrents.Count > 0,
            $"Expected at least one torrent for MIAA-710, but got {result.Torrents.Count}");

        var validTorrents = result.Torrents.Where(t =>
            !string.IsNullOrWhiteSpace(t.MagnetLink) &&
            t.MagnetLink.StartsWith("magnet:")).ToList();

        Assert.True(validTorrents.Count > 0,
            $"Expected at least one torrent with valid magnet link");
    }

    private record PlatformInfo(string OSName, string RID, Architecture Architecture);

    #endregion

    [Fact]
    public void GetPlatformInfo_ReturnsValidPlatformData()
    {
        // Act
        var platform = GetPlatformInfo();

        // Assert
        Assert.NotNull(platform);
        Assert.NotEmpty(platform.OSName);
        Assert.NotEmpty(platform.RID);
        Assert.True(platform.Architecture == Architecture.X64 ||
                    platform.Architecture == Architecture.X86 ||
                    platform.Architecture == Architecture.Arm ||
                    platform.Architecture == Architecture.Arm64,
            $"Unexpected architecture: {platform.Architecture}");
    }

    [Fact]
    public async Task SearchAsync_MIAA710_ReturnsValidResults_Not403()
    {
        // Arrange
        var platform = GetPlatformInfo();

        // Act
        var result = await _scraper.SearchAsync(TestJavId);

        // Assert - 验证搜索成功（不是 403 或空结果）
        AssertValidJavSearchResult(result, TestJavId);
        AssertHasValidTorrents(result);
    }

    [Fact]
    public async Task SearchCandidatesAsync_MIAA710_ReturnsMultipleCandidates()
    {
        // Act
        var candidates = await _scraper.SearchCandidatesAsync(TestJavId);

        // Assert
        Assert.NotNull(candidates);
        Assert.True(candidates.Count >= 1,
            $"Expected at least one candidate for MIAA-710");

        foreach (var candidate in candidates)
        {
            Assert.NotEmpty(candidate.Title);
            Assert.NotEmpty(candidate.DetailUrl);
        }
    }

    [Fact]
    public async Task GetDetailAsync_ValidUrl_ReturnsCompleteDetails()
    {
        // Arrange
        var candidates = await _scraper.SearchCandidatesAsync(TestJavId);
        Assert.True(candidates.Count > 0, "No candidates found for MIAA-710");

        var firstCandidate = candidates.First();

        // Act
        var detail = await _scraper.GetDetailAsync(firstCandidate.DetailUrl);

        // Assert
        AssertValidJavSearchResult(detail, TestJavId);
        AssertHasValidTorrents(detail);
    }
}

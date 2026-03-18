using JavManager.Services;
using Xunit;

namespace JavManager.Tests;

public class AppUpdateServiceTests
{
    [Theory]
    [InlineData("v0.1.0", "0.1.0")]
    [InlineData("  V1.2.3  ", "1.2.3")]
    [InlineData("0.1.0-beta1", "0.1.0-beta1")]
    public void NormalizeTagOrVersion_Strips_LeadingV(string input, string expected)
    {
        Assert.Equal(expected, AppUpdateService.NormalizeTagOrVersion(input));
    }

    [Theory]
    [InlineData("0.1.0", true)]
    [InlineData("v0.1.0", true)]
    [InlineData("0.1.0-beta1", true)]
    [InlineData("0.1.0+meta", true)]
    [InlineData("abc", false)]
    public void TryParseLooseVersion_Parses_Common_Forms(string input, bool expectedOk)
    {
        var ok = AppUpdateService.TryParseLooseVersion(input, out var v);
        Assert.Equal(expectedOk, ok);
        if (expectedOk)
            Assert.NotNull(v);
    }

    [Fact]
    public void IsNewerVersion_Compares_SemverLike()
    {
        Assert.True(AppUpdateService.IsNewerVersion("0.2.0", "0.1.9"));
        Assert.False(AppUpdateService.IsNewerVersion("0.1.0", "0.1.0"));
        Assert.False(AppUpdateService.IsNewerVersion("0.1.0-beta1", "0.1.0"));
    }

    [Fact]
    public void SelectAssetOrNull_Prefers_RidMatched_Exe_On_Windows()
    {
        var assets = new[]
        {
            new AppUpdateService.GitHubAsset { Name = "JavManager-win-x64.zip", DownloadUrl = new Uri("https://example/zip"), Size = 1 },
            new AppUpdateService.GitHubAsset { Name = "JavManager-win-x64.exe", DownloadUrl = new Uri("https://example/exe"), Size = 2 },
            new AppUpdateService.GitHubAsset { Name = "JavManager-linux-x64", DownloadUrl = new Uri("https://example/linux"), Size = 3 },
        };

        var selected = AppUpdateService.SelectAssetOrNull(assets, "win-x64");
        Assert.NotNull(selected);
        Assert.Equal("JavManager-win-x64.exe", selected!.Name);
        Assert.False(selected.IsZip);
    }
}


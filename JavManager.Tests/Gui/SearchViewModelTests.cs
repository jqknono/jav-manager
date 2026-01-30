using FluentAssertions;
using System.Diagnostics;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Gui.Localization;
using JavManager.Gui.ViewModels;
using JavManager.Localization;
using JavManager.Services;
using JavManager.Utils;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace JavManager.Tests.Gui;

public class SearchViewModelTests
{
    [Fact]
    public async Task SearchAsync_RemoteSearch_PopulatesCandidates_BeforeTorrents()
    {
        var javDb = new Mock<IJavDbDataProvider>(MockBehavior.Strict);
        javDb.Setup(p => p.SearchCandidatesAsync("STARS-001"))
            .ReturnsAsync(
                new List<JavSearchResult>
                {
                    new() { JavId = "STARS-001", Title = "STARS-001 Title A", DetailUrl = "https://example.invalid/a" },
                    new() { JavId = "STARS-001", Title = "STARS-001 Title B", DetailUrl = "https://example.invalid/b" },
                });

        var everything = new Mock<IEverythingSearchProvider>(MockBehavior.Strict);

        var qb = new Mock<IQBittorrentClient>(MockBehavior.Strict);
        var downloadService = new DownloadService(qb.Object, new DownloadConfig());

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["Console:HideOtherTorrents"] = "false",
            }).Build();
        var torrentSelectionService = new TorrentSelectionService(new WeightCalculator(), configuration);

        var loc = new LocalizationService();
        var guiLoc = new GuiLocalization(loc);

        var vm = new SearchViewModel(
            javDb.Object,
            everything.Object,
            torrentSelectionService,
            downloadService,
            new TorrentNameParser(),
            guiLoc,
            loc,
            new NullJavInfoTelemetryClient(),
            cacheProvider: null)
        {
            SearchQuery = "stars-001",
            SearchLocal = false,
            SearchRemote = true,
        };

        await vm.SearchCommand.ExecuteAsync(null);

        vm.RemoteCandidates.Should().HaveCount(2);
        vm.SearchResults.Should().BeEmpty();
        vm.SelectedCandidate.Should().BeNull();

        javDb.Verify(p => p.GetDetailAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SelectingCandidate_LoadsTorrents_AndShowsTorrentList()
    {
        var javDb = new Mock<IJavDbDataProvider>(MockBehavior.Strict);
        javDb.Setup(p => p.SearchCandidatesAsync("STARS-001"))
            .ReturnsAsync(
                new List<JavSearchResult>
                {
                    new() { JavId = "STARS-001", Title = "STARS-001 Title A", DetailUrl = "https://example.invalid/a" },
                });

        javDb.Setup(p => p.GetDetailAsync("https://example.invalid/a"))
            .ReturnsAsync(
                new JavSearchResult
                {
                    JavId = "",
                    Title = "STARS-001 Title A",
                    DetailUrl = "https://example.invalid/a",
                    Torrents =
                    [
                        new TorrentInfo { Title = "STARS-001 1080p", MagnetLink = "magnet:?xt=1", Size = 2_000_000_000, HasHd = true },
                        new TorrentInfo { Title = "STARS-001 720p", MagnetLink = "magnet:?xt=2", Size = 1_000_000_000, HasHd = true },
                    ],
                });

        var everything = new Mock<IEverythingSearchProvider>(MockBehavior.Strict);

        var qb = new Mock<IQBittorrentClient>(MockBehavior.Strict);
        var downloadService = new DownloadService(qb.Object, new DownloadConfig());

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["Console:HideOtherTorrents"] = "false",
            }).Build();
        var torrentSelectionService = new TorrentSelectionService(new WeightCalculator(), configuration);

        var loc = new LocalizationService();
        var guiLoc = new GuiLocalization(loc);

        var vm = new SearchViewModel(
            javDb.Object,
            everything.Object,
            torrentSelectionService,
            downloadService,
            new TorrentNameParser(),
            guiLoc,
            loc,
            new NullJavInfoTelemetryClient(),
            cacheProvider: null)
        {
            SearchQuery = "stars-001",
            SearchLocal = false,
            SearchRemote = true,
        };

        await vm.SearchCommand.ExecuteAsync(null);

        vm.RemoteCandidates.Should().HaveCount(1);
        vm.SelectedCandidate = vm.RemoteCandidates[0];

        await WaitUntilAsync(
            () => !vm.IsLoadingRemoteDetail && vm.SearchResults.Count > 0,
            TimeSpan.FromSeconds(2));

        vm.SearchResults.Should().HaveCount(2);
        vm.SelectedResult.Should().NotBeNull();
        vm.SelectedResult!.JavId.Should().Be("STARS-001");
    }

    private static async Task WaitUntilAsync(Func<bool> condition, TimeSpan timeout)
    {
        var sw = Stopwatch.StartNew();
        while (!condition())
        {
            if (sw.Elapsed > timeout)
                throw new TimeoutException("Condition not met within timeout.");
            await Task.Delay(10);
        }
    }
}

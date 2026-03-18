using FluentAssertions;
using JavManager.Core.Models;
using JavManager.Services;
using JavManager.Utils;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace JavManager.Tests.Services;

/// <summary>
/// TorrentSelectionService 单元测试
/// 测试种子选择服务的各种场景
/// </summary>
public class TorrentSelectionServiceTests
{
    private IConfiguration CreateConfiguration(bool hideOtherTorrents)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Console:HideOtherTorrents", hideOtherTorrents.ToString() }
            })
            .Build();
    }

    [Fact]
    public void SelectBestTorrent_EmptyList_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>();

        // Act
        var result = service.SelectBestTorrent(torrents);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void SelectBestTorrent_SingleItem_ReturnsIt()
    {
        // Arrange - torrent must have a marker to not be filtered out when HideOtherTorrents=true
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Only Torrent", HasHd = true }
        };

        // Act
        var result = service.SelectBestTorrent(torrents);

        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("Only Torrent");
    }

    [Fact]
    public void SelectBestTorrent_PrefersUncensored()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Regular", HasSubtitle = true },
            new() { Title = "Uncensored", HasUncensoredMarker = true }
        };

        // Act
        var result = service.SelectBestTorrent(torrents);

        // Assert
        result.Should().NotBeNull();
        result!.HasUncensoredMarker.Should().BeTrue();
    }

    [Fact]
    public void GetSortedTorrents_EmptyList_ReturnsEmpty()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);

        // Act
        var result = service.GetSortedTorrents(new List<TorrentInfo>());

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void GetSortedTorrents_HidesOtherTorrents_WhenConfigured()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "No markers" },
            new() { Title = "Has HD", HasHd = true }
        };

        // Act
        var result = service.GetSortedTorrents(torrents);

        // Assert
        result.Should().ContainSingle(t => t.HasHd);
        result.Should().NotContain(t => !t.HasHd && !t.HasUncensoredMarker && !t.HasSubtitle);
    }

    [Fact]
    public void GetSortedTorrents_IncludesAll_WhenNotConfigured()
    {
        // Arrange
        var config = CreateConfiguration(false);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "No markers" },
            new() { Title = "Has HD", HasHd = true }
        };

        // Act
        var result = service.GetSortedTorrents(torrents);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public void FormatTorrentInfo_NoTorrents_ReturnsHeaderOnly()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);

        // Act
        var result = service.FormatTorrentInfo(new List<TorrentInfo>());

        // Assert
        result.Should().Contain("找到 0 个种子源");
        result.Should().NotContain("推荐:");
    }

    [Fact]
    public void FormatTorrentInfo_FormatsMultipleTorrents()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "First", HasHd = true, Size = 1_000_000_000, Seeders = 10, Leechers = 5 },
            new() { Title = "Second", HasUncensoredMarker = true, Size = 2_000_000_000, Seeders = 20, Leechers = 10 }
        };

        // Act
        var result = service.FormatTorrentInfo(torrents);

        // Assert - Second comes first due to higher weight (uncensored > hd)
        result.Should().Contain("找到 2 个种子源");
        result.Should().Contain("1. Second");
        result.Should().Contain("2. First");
        result.Should().Contain("高清");
        result.Should().Contain("无码");
    }

    [Fact]
    public void FormatTorrentInfo_IncludesMarkers()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new()
            {
                Title = "Complete",
                HasHd = true,
                HasUncensoredMarker = true,
                HasSubtitle = true,
                Size = 1_000_000_000,
                Seeders = 10,
                Leechers = 5
            }
        };

        // Act
        var result = service.FormatTorrentInfo(torrents);

        // Assert
        result.Should().Contain("高清");
        result.Should().Contain("无码");
        result.Should().Contain("字幕");
        result.Should().Contain("标记:");
    }

    [Fact]
    public void FormatTorrentInfo_IncludesRecommendation()
    {
        // Arrange
        var config = CreateConfiguration(true);
        var calculator = new WeightCalculator();
        var service = new TorrentSelectionService(calculator, config);
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Best", HasHd = true }
        };

        // Act
        var result = service.FormatTorrentInfo(torrents);

        // Assert
        result.Should().Contain("推荐: Best");
    }
}

using FluentAssertions;
using JavManager.Core.Models;
using JavManager.Utils;
using Xunit;

namespace JavManager.Tests.Utils;

/// <summary>
/// WeightCalculator 单元测试
/// 测试种子权重计算器的各种场景
/// </summary>
public class WeightCalculatorTests
{
    private readonly WeightCalculator _calculator = new();

    [Fact]
    public void Calculate_WithNoMarkers_ReturnsZero()
    {
        // Arrange
        var torrent = new TorrentInfo { Title = "XXX-123" };

        // Act
        var result = _calculator.Calculate(torrent);

        // Assert
        result.Should().Be(0);
        torrent.WeightScore.Should().Be(0);
    }

    [Fact]
    public void Calculate_WithHdMarker_ReturnsOne()
    {
        // Arrange
        var torrent = new TorrentInfo { Title = "XXX-123", HasHd = true };

        // Act
        var result = _calculator.Calculate(torrent);

        // Assert
        result.Should().Be(1);
        torrent.WeightScore.Should().Be(1);
    }

    [Fact]
    public void Calculate_WithUncensoredMarker_ReturnsOne()
    {
        // Arrange
        var torrent = new TorrentInfo { Title = "XXX-123", HasUncensoredMarker = true };

        // Act
        var result = _calculator.Calculate(torrent);

        // Assert
        result.Should().Be(1);
        torrent.WeightScore.Should().Be(1);
    }

    [Fact]
    public void Calculate_WithSubtitleMarker_ReturnsOne()
    {
        // Arrange
        var torrent = new TorrentInfo { Title = "XXX-123", HasSubtitle = true };

        // Act
        var result = _calculator.Calculate(torrent);

        // Assert
        result.Should().Be(1);
        torrent.WeightScore.Should().Be(1);
    }

    [Fact]
    public void Calculate_WithAllMarkers_ReturnsThree()
    {
        // Arrange
        var torrent = new TorrentInfo
        {
            Title = "XXX-123",
            HasHd = true,
            HasUncensoredMarker = true,
            HasSubtitle = true
        };

        // Act
        var result = _calculator.Calculate(torrent);

        // Assert
        result.Should().Be(3);
        torrent.WeightScore.Should().Be(3);
    }

    [Fact]
    public void SelectBest_EmptyList_ReturnsNull()
    {
        // Arrange
        var torrents = new List<TorrentInfo>();

        // Act
        var result = _calculator.SelectBest(torrents);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void SelectBest_SingleItem_ReturnsIt()
    {
        // Arrange
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Only Torrent", HasHd = true }
        };

        // Act
        var result = _calculator.SelectBest(torrents);

        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("Only Torrent");
    }

    [Fact]
    public void SelectBest_ReturnsHighestWeighted()
    {
        // Arrange
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Low", HasHd = false },
            new() { Title = "High", HasHd = true, HasSubtitle = true }
        };

        // Act
        var result = _calculator.SelectBest(torrents);

        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("High");
        result.WeightScore.Should().Be(2);
    }

    [Fact]
    public void CalculateAndSort_SortsByPriority_UncensoredFirst()
    {
        // Arrange
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Regular", HasSubtitle = true },
            new() { Title = "Uncensored", HasUncensoredMarker = true }
        };

        // Act
        var result = _calculator.CalculateAndSort(torrents);

        // Assert
        result.First().HasUncensoredMarker.Should().BeTrue();
        result.Last().HasUncensoredMarker.Should().BeFalse();
    }

    [Fact]
    public void CalculateAndSort_ThenBySubtitle()
    {
        // Arrange
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "No Subtitle", HasUncensoredMarker = true },
            new() { Title = "With Subtitle", HasUncensoredMarker = true, HasSubtitle = true }
        };

        // Act
        var result = _calculator.CalculateAndSort(torrents);

        // Assert
        result.First().HasSubtitle.Should().BeTrue();
        result.Last().HasSubtitle.Should().BeFalse();
    }

    [Fact]
    public void CalculateAndSort_ThenBySizeForTieBreak()
    {
        // Arrange
        var torrents = new List<TorrentInfo>
        {
            new() { Title = "Small", HasUncensoredMarker = true, HasSubtitle = true, Size = 1_000_000_000 },
            new() { Title = "Large", HasUncensoredMarker = true, HasSubtitle = true, Size = 2_000_000_000 }
        };

        // Act
        var result = _calculator.CalculateAndSort(torrents);

        // Assert
        result.First().Size.Should().BeGreaterThan(result.Last().Size);
    }

    [Theory]
    [InlineData(true, false, false, 1)]
    [InlineData(false, true, false, 1)]
    [InlineData(false, false, true, 1)]
    [InlineData(true, true, false, 2)]
    [InlineData(true, false, true, 2)]
    [InlineData(false, true, true, 2)]
    [InlineData(true, true, true, 3)]
    public void Calculate_WithMarkerCombinations_ReturnsExpectedScore(bool hasHd, bool hasUncensored, bool hasSubtitle, int expectedScore)
    {
        // Arrange
        var torrent = new TorrentInfo
        {
            Title = "Test",
            HasHd = hasHd,
            HasUncensoredMarker = hasUncensored,
            HasSubtitle = hasSubtitle
        };

        // Act
        var result = _calculator.Calculate(torrent);

        // Assert
        result.Should().Be(expectedScore);
    }
}

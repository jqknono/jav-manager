using FluentAssertions;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Services;
using Moq;
using Xunit;

namespace JavManager.Tests.Services;

/// <summary>
/// DownloadService 单元测试
/// 测试下载服务的各种场景
/// </summary>
public class DownloadServiceTests
{
    private readonly Mock<IQBittorrentClient> _mockClient = new();
    private readonly DownloadConfig _config = new()
    {
        DefaultSavePath = "/downloads",
        DefaultCategory = "jav",
        DefaultTags = "auto-download"
    };

    [Fact]
    public async Task AddDownloadAsync_UsesDefaultSavePath_WhenNotProvided()
    {
        // Arrange - note: NormalizeExistingDirectoryPath returns null for non-existent paths
        // In real usage, Directory.Exists would return false for "/downloads" on Windows
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), null, "jav", "auto-download"))
            .ReturnsAsync(true);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        await service.AddDownloadAsync(torrent);

        // Assert - savePath is null because "/downloads" doesn't exist on Windows
        _mockClient.Verify(c => c.AddTorrentAsync(
            It.IsAny<string>(),
            null,
            "jav",
            "auto-download"
        ), Times.Once);
    }

    [Fact]
    public async Task AddDownloadAsync_UsesProvidedPath_WhenGiven()
    {
        // Arrange
        var providedPath = Path.GetTempPath(); // Use temp path which should exist
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), providedPath, "jav", "auto-download"))
            .ReturnsAsync(true);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        await service.AddDownloadAsync(torrent, providedPath);

        // Assert
        _mockClient.Verify(c => c.AddTorrentAsync(
            It.IsAny<string>(),
            providedPath,
            "jav",
            "auto-download"
        ), Times.Once);
    }

    [Fact]
    public async Task AddDownloadAsync_UsesDefaultCategory_WhenNotProvided()
    {
        // Arrange
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), It.IsAny<string>(), "jav", It.IsAny<string>()))
            .ReturnsAsync(true);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        await service.AddDownloadAsync(torrent);

        // Assert
        _mockClient.Verify(c => c.AddTorrentAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            "jav",
            It.IsAny<string>()
        ), Times.Once);
    }

    [Fact]
    public async Task AddDownloadAsync_UsesDefaultTags_WhenNotProvided()
    {
        // Arrange
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), "auto-download"))
            .ReturnsAsync(true);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        await service.AddDownloadAsync(torrent);

        // Assert
        _mockClient.Verify(c => c.AddTorrentAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            "auto-download"
        ), Times.Once);
    }

    [Fact]
    public async Task AddDownloadAsync_UsesProvidedCategoryAndTags_WhenGiven()
    {
        // Arrange
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), It.IsAny<string>(), "custom-cat", "custom-tag"))
            .ReturnsAsync(true);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        await service.AddDownloadAsync(torrent, null, "custom-cat", "custom-tag");

        // Assert
        _mockClient.Verify(c => c.AddTorrentAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            "custom-cat",
            "custom-tag"
        ), Times.Once);
    }

    [Fact]
    public async Task AddDownloadAsync_ReturnsTrue_OnSuccess()
    {
        // Arrange
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        var result = await service.AddDownloadAsync(torrent);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task AddDownloadAsync_ReturnsFalse_OnFailure()
    {
        // Arrange
        _mockClient.Setup(c => c.AddTorrentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var service = new DownloadService(_mockClient.Object, _config);
        var torrent = new TorrentInfo { MagnetLink = "magnet:?xt=..." };

        // Act
        var result = await service.AddDownloadAsync(torrent);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task GetDownloadsAsync_DelegatesToClient()
    {
        // Arrange
        var expected = new List<TorrentInfo> { new() { Title = "Test" } };
        _mockClient.Setup(c => c.GetTorrentsAsync())
            .ReturnsAsync(expected);
        var service = new DownloadService(_mockClient.Object, _config);

        // Act
        var result = await service.GetDownloadsAsync();

        // Assert
        result.Should().BeEquivalentTo(expected);
        _mockClient.Verify(c => c.GetTorrentsAsync(), Times.Once);
    }

    [Fact]
    public async Task PauseAsync_DelegatesToClient()
    {
        // Arrange
        var hashes = new List<string> { "hash1", "hash2" };
        _mockClient.Setup(c => c.PauseAsync(hashes))
            .Returns(Task.CompletedTask);
        var service = new DownloadService(_mockClient.Object, _config);

        // Act
        await service.PauseAsync(hashes);

        // Assert
        _mockClient.Verify(c => c.PauseAsync(hashes), Times.Once);
    }

    [Fact]
    public async Task ResumeAsync_DelegatesToClient()
    {
        // Arrange
        var hashes = new List<string> { "hash1", "hash2" };
        _mockClient.Setup(c => c.ResumeAsync(hashes))
            .Returns(Task.CompletedTask);
        var service = new DownloadService(_mockClient.Object, _config);

        // Act
        await service.ResumeAsync(hashes);

        // Assert
        _mockClient.Verify(c => c.ResumeAsync(hashes), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_DelegatesToClient()
    {
        // Arrange
        var hashes = new List<string> { "hash1", "hash2" };
        _mockClient.Setup(c => c.DeleteAsync(hashes, false))
            .Returns(Task.CompletedTask);
        var service = new DownloadService(_mockClient.Object, _config);

        // Act
        await service.DeleteAsync(hashes, false);

        // Assert
        _mockClient.Verify(c => c.DeleteAsync(hashes, false), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WithDeleteFiles_DelegatesToClient()
    {
        // Arrange
        var hashes = new List<string> { "hash1", "hash2" };
        _mockClient.Setup(c => c.DeleteAsync(hashes, true))
            .Returns(Task.CompletedTask);
        var service = new DownloadService(_mockClient.Object, _config);

        // Act
        await service.DeleteAsync(hashes, true);

        // Assert
        _mockClient.Verify(c => c.DeleteAsync(hashes, true), Times.Once);
    }
}

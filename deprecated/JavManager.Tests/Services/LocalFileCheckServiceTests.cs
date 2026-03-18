using FluentAssertions;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Services;
using JavManager.Utils;
using Moq;
using Xunit;

namespace JavManager.Tests.Services;

/// <summary>
/// LocalFileCheckService 单元测试
/// 测试本地文件检查服务的各种场景
/// </summary>
public class LocalFileCheckServiceTests
{
    private readonly Mock<IEverythingSearchProvider> _mockProvider = new();
    private readonly TorrentNameParser _parser = new();

    [Fact]
    public async Task FileExistsAsync_ReturnsTrue_WhenFilesFound()
    {
        // Arrange
        _mockProvider.Setup(p => p.SearchAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<LocalFileInfo> { new() { FileType = FileType.Video } });
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = await service.FileExistsAsync("XXX-123");

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task FileExistsAsync_ReturnsFalse_WhenNoFiles()
    {
        // Arrange
        _mockProvider.Setup(p => p.SearchAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<LocalFileInfo>());
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = await service.FileExistsAsync("XXX-123");

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task FileExistsAsync_FiltersVideoFiles()
    {
        // Arrange
        _mockProvider.Setup(p => p.SearchAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<LocalFileInfo>
            {
                new() { FileType = FileType.Video },
                new() { FileType = FileType.Folder },
                new() { FileType = FileType.Torrent }
            });
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = await service.CheckLocalFilesAsync("XXX-123");

        // Assert
        result.Should().ContainSingle();
        result.First().FileType.Should().Be(FileType.Video);
    }

    [Fact]
    public async Task CheckLocalFilesAsync_ReturnsVideoFiles()
    {
        // Arrange
        var expectedFiles = new List<LocalFileInfo>
        {
            new() { FileName = "video1.mp4", FileType = FileType.Video },
            new() { FileName = "video2.mkv", FileType = FileType.Video }
        };
        _mockProvider.Setup(p => p.SearchAsync(It.IsAny<string>()))
            .ReturnsAsync(expectedFiles);
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = await service.CheckLocalFilesAsync("XXX-123");

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(f => f.FileType == FileType.Video);
    }

    [Fact]
    public void FormatLocalFileInfo_EmptyList_ReturnsNotFoundMessage()
    {
        // Arrange
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = service.FormatLocalFileInfo(new List<LocalFileInfo>());

        // Assert
        result.Should().Contain("未找到本地文件");
    }

    [Fact]
    public void FormatLocalFileInfo_FormatsSingleFile()
    {
        // Arrange
        var files = new List<LocalFileInfo>
        {
            new()
            {
                FileName = "XXX-123.mp4",
                FullPath = @"C:\Videos\XXX-123.mp4",
                Size = 1_000_000_000,
                ModifiedDate = new DateTime(2024, 1, 15, 10, 30, 0)
            }
        };
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = service.FormatLocalFileInfo(files);

        // Assert
        result.Should().Contain("找到 1 个本地文件");
        result.Should().Contain("XXX-123.mp4");
        result.Should().Contain(@"C:\Videos\XXX-123.mp4");
    }

    [Fact]
    public void FormatLocalFileInfo_FormatsMultipleFiles()
    {
        // Arrange
        var files = new List<LocalFileInfo>
        {
            new() { FileName = "XXX-123.mp4", FullPath = @"C:\Videos\1.mp4", Size = 1_000_000_000, ModifiedDate = DateTime.Now },
            new() { FileName = "XXX-123.mkv", FullPath = @"C:\Videos\2.mkv", Size = 2_000_000_000, ModifiedDate = DateTime.Now }
        };
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = service.FormatLocalFileInfo(files);

        // Assert
        result.Should().Contain("找到 2 个本地文件");
        result.Should().Contain("1. XXX-123.mp4");
        result.Should().Contain("2. XXX-123.mkv");
    }

    [Fact]
    public void FormatLocalFileInfo_IncludesSizeAndDate()
    {
        // Arrange
        var files = new List<LocalFileInfo>
        {
            new()
            {
                FileName = "XXX-123.mp4",
                FullPath = @"C:\Videos\XXX-123.mp4",
                Size = 1_073_741_824, // 1 GB
                ModifiedDate = new DateTime(2024, 1, 15, 10, 30, 0)
            }
        };
        var service = new LocalFileCheckService(_mockProvider.Object, _parser);

        // Act
        var result = service.FormatLocalFileInfo(files);

        // Assert
        result.Should().Contain("大小:");
        result.Should().Contain("修改时间:");
        result.Should().Contain("2024-01-15 10:30");
        result.Should().Contain("GB"); // Size in GB
    }
}

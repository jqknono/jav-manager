using FluentAssertions;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Models;
using JavManager.DataProviders.QBittorrent;
using JavManager.Localization;
using JavManager.Tests.TestHelpers;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;
using Xunit;

namespace JavManager.Tests.DataProviders.QBittorrent;

/// <summary>
/// QBittorrentApiClient 集成测试
/// 使用 WireMock.Net 模拟 qBittorrent WebUI API 服务器
/// </summary>
public sealed class QBittorrentApiClientTests : IAsyncDisposable
{
    private readonly WireMockServer _server;
    private readonly QBittorrentApiClient _client;
    private readonly QBittorrentConfig _config;
    private readonly LocalizationService _localizationService;

    public QBittorrentApiClientTests()
    {
        // Start WireMock server
        _server = WireMockServer.Start();

        // Setup configuration
        _config = new QBittorrentConfig
        {
            BaseUrl = _server.Url!,
            UserName = "admin",
            Password = "password123"
        };

        // Setup localization service
        _localizationService = new LocalizationService();

        // Create client with mocked HTTP server
        _client = new QBittorrentApiClient(_config, _localizationService);
    }

    [Fact]
    public async Task LoginAsync_Success_ReturnsOk()
    {
        // Arrange
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Act
        var exception = await Record.ExceptionAsync(() => _client.LoginAsync());

        // Assert - No exception should be thrown on successful login
        exception.Should().BeNull();
    }

    [Fact]
    public async Task LoginAsync_Failure_ThrowsException()
    {
        // Arrange
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(401)
                .WithBody("Fails."));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => _client.LoginAsync());
    }

    [Fact]
    public async Task AddTorrentAsync_WithMagnetLink_Success()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup torrent add
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/add")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup torrent info check
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/info")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("[{\"hash\":\"abc123\",\"name\":\"Test Torrent\"}]"));

        var magnetLink = "magnet:?xt=urn:btih:abc123def456";

        // Act
        var result = await _client.AddTorrentAsync(magnetLink, "/downloads", "movies", "test-tag");

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task AddTorrentFromUrlAsync_WithMultipleUrls_Success()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup torrent add
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/add")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        var urls = new List<string>
        {
            "https://example.com/torrent1.torrent",
            "https://example.com/torrent2.torrent"
        };

        // Act
        var result = await _client.AddTorrentFromUrlAsync(urls, "/downloads", "movies", "test-tag");

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task GetTorrentsAsync_ReturnsTorrentList()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup torrents info
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/info")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("""
                    [
                        {
                            "hash": "abc123",
                            "name": "Test Torrent 1",
                            "size": 1073741824,
                            "num_seeds": 10,
                            "num_leechs": 5,
                            "magnet_uri": "magnet:?xt=urn:btih:abc123",
                            "progress": 0.5,
                            "state": "downloading"
                        },
                        {
                            "hash": "def456",
                            "name": "Test Torrent 2",
                            "size": 2147483648,
                            "num_seeds": 20,
                            "num_leechs": 10,
                            "magnet_uri": "magnet:?xt=urn:btih:def456",
                            "progress": 1.0,
                            "state": "uploading"
                        }
                    ]
                    """));

        // Act
        var result = await _client.GetTorrentsAsync();

        // Assert
        result.Should().HaveCount(2);
        result[0].Title.Should().Be("Test Torrent 1");
        result[0].Size.Should().Be(1073741824);
        result[0].Seeders.Should().Be(10);
        result[0].Leechers.Should().Be(5);
        result[0].Progress.Should().Be(0.5);
        result[0].State.Should().Be("downloading");

        result[1].Title.Should().Be("Test Torrent 2");
        result[1].Size.Should().Be(2147483648);
        result[1].Seeders.Should().Be(20);
        result[1].Leechers.Should().Be(10);
        result[1].Progress.Should().Be(1.0);
        result[1].State.Should().Be("uploading");
    }

    [Fact]
    public async Task PauseAsync_WithHashes_Success()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup pause endpoint
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/stop")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200));

        var hashes = new List<string> { "abc123", "def456" };

        // Act & Assert - No exception should be thrown
        var exception = await Record.ExceptionAsync(() => _client.PauseAsync(hashes));
        exception.Should().BeNull();
    }

    [Fact]
    public async Task ResumeAsync_WithHashes_Success()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup resume endpoint
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/start")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200));

        var hashes = new List<string> { "abc123", "def456" };

        // Act & Assert - No exception should be thrown
        var exception = await Record.ExceptionAsync(() => _client.ResumeAsync(hashes));
        exception.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_WithoutDeleteFiles_Success()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup delete endpoint
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/delete")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200));

        var hashes = new List<string> { "abc123", "def456" };

        // Act & Assert - No exception should be thrown
        var exception = await Record.ExceptionAsync(() => _client.DeleteAsync(hashes, false));
        exception.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_WithDeleteFiles_Success()
    {
        // Arrange - Setup login
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Setup delete endpoint
        _server.Given(Request.Create()
                .WithPath("/api/v2/torrents/delete")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200));

        var hashes = new List<string> { "abc123" };

        // Act & Assert - No exception should be thrown
        var exception = await Record.ExceptionAsync(() => _client.DeleteAsync(hashes, true));
        exception.Should().BeNull();
    }

    [Fact]
    public async Task CheckHealthAsync_ConnectionSuccess_ReturnsHealthy()
    {
        // Arrange
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithBody("Ok."));

        // Act
        var result = await _client.CheckHealthAsync();

        // Assert
        result.IsHealthy.Should().BeTrue();
        result.Message.Should().Contain("OK");
    }

    [Fact]
    public async Task CheckHealthAsync_ConnectionFailure_ReturnsUnhealthy()
    {
        // Arrange
        _server.Given(Request.Create()
                .WithPath("/api/v2/auth/login")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(401)
                .WithBody("Unauthorized"));

        // Act
        var result = await _client.CheckHealthAsync();

        // Assert
        result.IsHealthy.Should().BeFalse();
        result.Message.Should().Contain("failed");
    }

    public async ValueTask DisposeAsync()
    {
        _server?.Stop();
        _client?.Dispose();
    }
}

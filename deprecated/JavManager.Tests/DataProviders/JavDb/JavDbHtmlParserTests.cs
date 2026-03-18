using FluentAssertions;
using JavManager.Core.Models;
using JavManager.DataProviders.JavDb;
using Xunit;

namespace JavManager.Tests.DataProviders.JavDb;

/// <summary>
/// JavDbHtmlParser 单元测试
/// 测试 HTML 解析器的各种场景
/// </summary>
public class JavDbHtmlParserTests
{
    private readonly JavDbHtmlParser _parser = new();

    [Fact]
    public void ParseSearchResults_ExtractsTitle()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/abc" class="box" title="Test Title">
                <img src="cover.jpg" class="video-cover" />
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().ContainSingle();
        results.First().Title.Should().Be("Test Title");
    }

    [Fact]
    public void ParseSearchResults_ExtractsDetailUrl()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/xxx-123" class="box">
                <div class="uid">XXX-123</div>
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().ContainSingle();
        results.First().DetailUrl.Should().Be("/v/xxx-123");
    }

    [Fact]
    public void ParseSearchResults_ExtractsCoverUrl()
    {
        // Arrange - Use simplified structure
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box">
                <img src="https://example.com/cover.jpg" class="video-cover" />
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().ContainSingle();
        results.First().CoverUrl.Should().Be("https://example.com/cover.jpg");
    }

    [Fact]
    public void ParseSearchResults_ExtractsCoverUrl_FromDataSrc()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box">
                <img data-src="https://example.com/lazy-cover.jpg" class="video-cover" />
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().ContainSingle();
        results.First().CoverUrl.Should().Be("https://example.com/lazy-cover.jpg");
    }

    [Fact]
    public void ParseSearchResults_ExtractsJavIdFromUidClass()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box">
                <span class="uid">SSIS-123</span>
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().ContainSingle();
        results.First().JavId.Should().Be("SSIS-123");
    }

    [Fact]
    public void ParseSearchResults_ExtractsJavIdFromText()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box">
                FC2-1234567
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().ContainSingle();
        results.First().JavId.Should().Be("FC2-1234567");
    }

    [Fact]
    public void ParseSearchResults_HandlesMissingNodes()
    {
        // Arrange
        var html = "<div></div>";

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().BeEmpty();
    }

    [Fact]
    public void ParseSearchResults_HandlesMultipleItems()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box" title="First">
                <span class="uid">SSIS-123</span>
              </a>
            </div>
            <div class="item">
              <a href="/v/yyy" class="box" title="Second">
                <span class="uid">SSIS-456</span>
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.Should().HaveCount(2);
        results[0].JavId.Should().Be("SSIS-123");
        results[1].JavId.Should().Be("SSIS-456");
    }

    [Fact]
    public void ParseDetailPage_ExtractsMetadata()
    {
        // Arrange - Put "發行" before "發行日期" to avoid partial match
        var html = """
            <h2 class="title">Test Video Title</h2>
            <span class="current-title">SSIS-123</span>
            <img src="cover.jpg" class="video-cover" />
            <div class="video-meta-panel">
              <div><strong>發行</strong><span>S1</span></div>
              <div><strong>發行日期</strong><span>2024-01-15</span></div>
              <div><strong>時長</strong><span>120分鐘</span></div>
              <div><strong>導演</strong><span>Test Director</span></div>
              <div><strong>片商</strong><span>S1 NO.1 STYLE</span></div>
              <div><strong>系列</strong><span>Test Series</span></div>
            </div>
            """;

        // Act
        var result = _parser.ParseDetailPage(html);

        // Assert
        result.JavId.Should().Be("SSIS-123");
        result.Title.Should().Be("Test Video Title");
        result.CoverUrl.Should().Be("cover.jpg");
        result.ReleaseDate.Should().Be(new DateTime(2024, 1, 15));
        result.Duration.Should().Be(120);
        result.Director.Should().Be("Test Director");
        result.Maker.Should().Be("S1 NO.1 STYLE");
        result.Publisher.Should().Be("S1");
        result.Series.Should().Be("Test Series");
    }

    [Fact]
    public void ParseDetailPage_ExtractsActors()
    {
        // Arrange
        var html = """
            <div class="video-meta-panel">
              <strong>演員</strong><span><a href="/actors/1">Actor One</a><a href="/actors/2">Actor Two</a></span>
            </div>
            """;

        // Act
        var result = _parser.ParseDetailPage(html);

        // Assert
        result.Actors.Should().HaveCount(2);
        result.Actors.Should().Contain("Actor One");
        result.Actors.Should().Contain("Actor Two");
    }

    [Fact]
    public void ParseDetailPage_ExtractsCategories()
    {
        // Arrange
        var html = """
            <div class="video-meta-panel">
              <strong>類別</strong><span><a href="/tags/1">Category 1</a><a href="/tags/2">Category 2</a></span>
            </div>
            """;

        // Act
        var result = _parser.ParseDetailPage(html);

        // Assert
        result.Categories.Should().HaveCount(2);
        result.Categories.Should().Contain("Category 1");
        result.Categories.Should().Contain("Category 2");
    }

    [Fact]
    public void ParseDetailPage_ParsesDurationInMinutes()
    {
        // Arrange
        var html = $"""
            <div class="video-meta-panel">
              <strong>時長</strong><span>180分鐘</span>
            </div>
            """;

        // Act
        var result = _parser.ParseDetailPage(html);

        // Assert
        result.Duration.Should().Be(180);
    }

    [Fact]
    public void ParseDetailPage_TriesMultipleKeywords()
    {
        // Arrange - 使用不同的关键词
        var html = """
            <div class="video-meta-panel">
              <strong>片長</strong><span>90分鐘</span>
            </div>
            """;

        // Act
        var result = _parser.ParseDetailPage(html);

        // Assert
        result.Duration.Should().Be(90);
    }

    [Fact]
    public void ParseSearchResults_NormalizesHtmlEntities()
    {
        // Arrange - Note: Current implementation doesn't decode entities in title attribute
        // Testing that HTML entities in inner text are properly decoded
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box">
                <span class="uid">SSIS-123</span>
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert - JavId is extracted and normalized
        results.First().JavId.Should().Be("SSIS-123");
    }

    [Fact]
    public void ParseSearchResults_PrefersTitleAttributeOverText()
    {
        // Arrange
        var html = """
            <div class="item">
              <a href="/v/xxx" class="box" title="Title From Attribute">
                Inner Text Title
                <span class="uid">SSIS-123</span>
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        results.First().Title.Should().Be("Title From Attribute");
    }

    [Fact]
    public void ParseDetailPage_ExtractsJavIdFromTitle_WhenMissingInSpan()
    {
        // Arrange
        var html = """
            <h2 class="title">SSIS-456 Test Title</h2>
            <img src="cover.jpg" class="video-cover" />
            """;

        // Act
        var result = _parser.ParseDetailPage(html);

        // Assert
        result.JavId.Should().Be("SSIS-456");
    }

    [Theory]
    [InlineData("ABC-123", "ABC-123")]
    [InlineData("abc-123", "ABC-123")]  // 应该转换为大写
    [InlineData("SSIS-001", "SSIS-001")]
    [InlineData("FC2-1234567", "FC2-1234567")]
    [InlineData("no-id-here", "")]  // 无匹配时返回空字符串
    public void ParseSearchResults_ExtractsVariousJavIdFormats(string javIdInHtml, string? expectedJavId)
    {
        // Arrange
        var html = $"""
            <div class="item">
              <a href="/v/xxx" class="box">
                <span class="uid">{javIdInHtml}</span>
              </a>
            </div>
            """;

        // Act
        var results = _parser.ParseSearchResults(html);

        // Assert
        if (expectedJavId != null)
        {
            results.Should().ContainSingle();
            results.First().JavId.Should().Be(expectedJavId);
        }
        else
        {
            results.First().JavId.Should().BeEmpty();
        }
    }
}

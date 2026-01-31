using JavManager.Gui.Utils;
using Xunit;

namespace JavManager.Tests;

public class UiMessageFormatterTests
{
    [Fact]
    public void ToSummaryAndDetails_Empty_Returns_Empty()
    {
        var (summary, details) = UiMessageFormatter.ToSummaryAndDetails(string.Empty);
        Assert.Equal(string.Empty, summary);
        Assert.Equal(string.Empty, details);
    }

    [Fact]
    public void ToSummaryAndDetails_NoSeparator_Returns_Message_As_Summary()
    {
        var (summary, details) = UiMessageFormatter.ToSummaryAndDetails("All URLs unreachable");
        Assert.Equal("All URLs unreachable", summary);
        Assert.Equal(string.Empty, details);
    }

    [Fact]
    public void ToSummaryAndDetails_Does_Not_Split_Urls()
    {
        var (summary, details) = UiMessageFormatter.ToSummaryAndDetails("http://localhost:8080");
        Assert.Equal("http://localhost:8080", summary);
        Assert.Equal(string.Empty, details);
    }

    [Fact]
    public void ToSummaryAndDetails_ColonSpace_Splits_Once()
    {
        var (summary, details) = UiMessageFormatter.ToSummaryAndDetails("Connection failed: HTTP request failed: Invalid URI");
        Assert.Equal("Connection failed", summary);
        Assert.Equal("HTTP request failed: Invalid URI", details);
    }

    [Fact]
    public void ToSummaryAndDetails_FullWidthColon_Splits()
    {
        var (summary, details) = UiMessageFormatter.ToSummaryAndDetails("连接失败：HTTP 请求失败：无效 URI");
        Assert.Equal("连接失败", summary);
        Assert.Equal("HTTP 请求失败：无效 URI", details);
    }

    [Fact]
    public void ToSummaryAndDetails_Trims_Summary_And_Details()
    {
        var (summary, details) = UiMessageFormatter.ToSummaryAndDetails("  Connection failed:   Invalid URI   ");
        Assert.Equal("Connection failed", summary);
        Assert.Equal("Invalid URI", details);
    }
}

using JavManager.Utils;
using Xunit;

namespace JavManager.Tests;

public class SizeParserTests
{
    [Theory]
    [InlineData("100MB", 100L * 1024 * 1024)]
    [InlineData("100 MB", 100L * 1024 * 1024)]
    [InlineData("1GB", 1024L * 1024 * 1024)]
    [InlineData("1.5GB", (long)(1.5 * 1024 * 1024 * 1024))]
    [InlineData("0", 0)]
    public void TryParseToBytes_Parses_Common_Units(string input, long expected)
    {
        Assert.True(SizeParser.TryParseToBytes(input, out var bytes));
        Assert.Equal(expected, bytes);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("10XB")]
    public void TryParseToBytes_Rejects_Invalid(string input)
    {
        Assert.False(SizeParser.TryParseToBytes(input, out _));
    }
}


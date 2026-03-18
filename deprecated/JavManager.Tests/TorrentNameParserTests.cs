using JavManager.Core.Models;
using JavManager.Utils;
using Xunit;

namespace JavManager.Tests;

public class TorrentNameParserTests
{
    [Theory]
    [InlineData("ipx-404-C.torrent", UncensoredMarkerType.None)]
    [InlineData("ipx-404-U.torrent", UncensoredMarkerType.U)]
    [InlineData("ipx-404-UC.torrent", UncensoredMarkerType.UC)]
    [InlineData("IPX-404-uc.mkv", UncensoredMarkerType.UC)]
    [InlineData("ipx-404 无码.torrent", UncensoredMarkerType.U)]
    public void Parse_Recognizes_UncensoredMarkers_In_Title(
        string title,
        UncensoredMarkerType expectedType)
    {
        var parser = new TorrentNameParser();

        var (type, hasSubtitle) = parser.Parse(title);

        Assert.Equal(expectedType, type);
        Assert.False(hasSubtitle);
    }

    [Fact]
    public void Parse_DoesNot_Match_Prefixes()
    {
        var parser = new TorrentNameParser();

        var (type, hasSubtitle) = parser.Parse("ipx-404-CH.torrent");

        Assert.Equal(UncensoredMarkerType.None, type);
        Assert.False(hasSubtitle);
    }

    [Theory]
    [InlineData("IPZZ-408-UC.torrent.无码破解", "IPZZ-408")]
    [InlineData("ipzz_408 something", "IPZZ-408")]
    [InlineData("  ipzz-408  ", "IPZZ-408")]
    public void NormalizeJavId_Extracts_Id_From_Title(string input, string expected)
    {
        var parser = new TorrentNameParser();

        var actual = parser.NormalizeJavId(input);

        Assert.Equal(expected, actual);
    }
}

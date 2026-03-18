using JavManager.DataProviders.Everything;
using Xunit;

namespace JavManager.Tests;

public class EverythingHttpClientTests
{
    [Fact]
    public void ParseEverythingDateModified_Handles_FileTime()
    {
        var utc = new DateTime(2024, 11, 15, 0, 0, 0, DateTimeKind.Utc);
        var fileTime = utc.ToFileTimeUtc();

        var expected = DateTime.FromFileTimeUtc(fileTime).ToLocalTime();
        var actual = EverythingHttpClient.ParseEverythingDateModified(fileTime);

        Assert.Equal(expected, actual);
    }
}


using FluentAssertions;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Gui.Services;
using Newtonsoft.Json.Linq;
using Xunit;

namespace JavManager.Tests.Gui;

public sealed class GuiConfigFileServiceTests
{
    [Fact]
    public async Task SaveAsync_WhenMirrorUrlsProvided_WritesMirrorUrlsArray()
    {
        var tempDir = Directory.CreateTempSubdirectory("jav-manager-tests-");
        try
        {
            var configPath = Path.Combine(tempDir.FullName, "appsettings.json");
            await File.WriteAllTextAsync(configPath, """
            {
              "JavDb": { "BaseUrl": "https://javdb.com", "MirrorUrls": [] },
              "Console": { "Language": "en" }
            }
            """);

            var service = new GuiConfigFileService(configPath);

            var everything = new EverythingConfig { BaseUrl = "http://ev" };
            var qb = new QBittorrentConfig { BaseUrl = "http://qb" };
            var javDb = new JavDbConfig
            {
                BaseUrl = "https://javdb.com",
                MirrorUrls = new List<string> { "https://a.example", " https://b.example " }
            };
            var download = new DownloadConfig();

            await service.SaveAsync(everything, qb, javDb, download, language: "en");

            var json = JObject.Parse(await File.ReadAllTextAsync(configPath));
            json["JavDb"]!["MirrorUrls"]!.Type.Should().Be(JTokenType.Array);
            json["JavDb"]!["MirrorUrls"]!.Values<string>().Should().Equal("https://a.example", "https://b.example");
        }
        finally
        {
            try { tempDir.Delete(recursive: true); } catch { /* best-effort */ }
        }
    }
}

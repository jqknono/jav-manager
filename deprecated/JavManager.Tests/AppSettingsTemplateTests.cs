using System.Reflection;
using System.Text.Json;
using JavManager.Utils;
using Xunit;

namespace JavManager.Tests;

public class AppSettingsTemplateTests
{
    [Fact]
    public void TryWriteAppSettingsJsonIfMissing_CreatesTemplateWithBlankLocalSettings()
    {
        var programType = typeof(AppInfo).Assembly.GetType("JavManager.Program");
        Assert.NotNull(programType);

        var getBytesMethod = programType!.GetMethod("TryGetEmbeddedAppSettingsJsonBytes", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(getBytesMethod);

        var bytesObj = getBytesMethod!.Invoke(null, null);
        var templateBytes = Assert.IsType<byte[]>(bytesObj);

        var tempDir = Path.Combine(Path.GetTempPath(), "JavManager.Tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        var configPath = Path.Combine(tempDir, "appsettings.json");
        Assert.False(File.Exists(configPath));

        try
        {
            var writeMethod = programType.GetMethod("TryWriteAppSettingsJsonIfMissing", BindingFlags.NonPublic | BindingFlags.Static);
            Assert.NotNull(writeMethod);

            writeMethod!.Invoke(null, new object?[] { tempDir, templateBytes });

            Assert.True(File.Exists(configPath));

            using var doc = JsonDocument.Parse(File.ReadAllText(configPath));
            var root = doc.RootElement;

            Assert.Equal(string.Empty, root.GetProperty("Everything").GetProperty("BaseUrl").GetString());
            Assert.Equal(string.Empty, root.GetProperty("QBittorrent").GetProperty("BaseUrl").GetString());
            Assert.Null(root.GetProperty("QBittorrent").GetProperty("UserName").GetString());
            Assert.Null(root.GetProperty("QBittorrent").GetProperty("Password").GetString());
        }
        finally
        {
            try
            {
                Directory.Delete(tempDir, recursive: true);
            }
            catch
            {
                // ignore cleanup failures in test environment
            }
        }
    }
}

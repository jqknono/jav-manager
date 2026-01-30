using System.Reflection;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Utils;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace JavManager.Tests;

public class ConfigurationBuilderTests
{
    [Fact]
    public void BuildConfiguration_UsesEnvironmentOverrides()
    {
        var appSettingsPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        var previous = Environment.GetEnvironmentVariable("JAVMANAGER_JavDb__UserAgent");

        File.WriteAllText(appSettingsPath, "{}");

        try
        {
            Environment.SetEnvironmentVariable("JAVMANAGER_JavDb__UserAgent", "test-user-agent");

            var config = InvokeBuildConfiguration();
            var javDbConfig = config.GetSection("JavDb").Get<JavDbConfig>();

            Assert.Equal("test-user-agent", javDbConfig?.UserAgent);
        }
        finally
        {
            Environment.SetEnvironmentVariable("JAVMANAGER_JavDb__UserAgent", previous);
            if (File.Exists(appSettingsPath))
                File.Delete(appSettingsPath);
        }
    }

    private static IConfiguration InvokeBuildConfiguration()
    {
        var programType = typeof(AppInfo).Assembly.GetType("JavManager.Program");
        var method = programType?.GetMethod("BuildConfiguration", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var config = method!.Invoke(null, null);
        Assert.NotNull(config);

        return (IConfiguration)config!;
    }
}

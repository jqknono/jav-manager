using System.Reflection;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Localization;
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

            var config = InvokeBuildConfiguration(null);
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

    [Fact]
    public void ExtractConfigurationOverrides_ExtractsKnownOptionsAndKeepsRemainingArgs()
    {
        var args = new[]
        {
            "--lang", "zh",
            "--qb-url", "http://localhost:18080",
            "s", "ABP-123"
        };

        var (overrides, remainingArgs) = InvokeExtractConfigurationOverrides(args);

        Assert.Equal("zh", overrides["Console:Language"]);
        Assert.Equal("http://localhost:18080", overrides["QBittorrent:BaseUrl"]);
        Assert.Equal(new[] { "s", "ABP-123" }, remainingArgs);
    }

    [Fact]
    public void BuildConfiguration_UsesCommandLineOverrides_ForServicesAndLanguage()
    {
        var appSettingsPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        File.WriteAllText(appSettingsPath, "{}");

        try
        {
            var args = new[]
            {
                "--lang", "zh",
                "--qb-url", "http://localhost:18080",
                "--qb-user", "u",
                "--qb-pass", "p",
                "--everything-url", "http://localhost:8888",
                "--everything-user", "eu",
                "--everything-pass", "ep"
            };

            var (overrides, _) = InvokeExtractConfigurationOverrides(args);
            var config = InvokeBuildConfiguration(overrides);

            var qb = config.GetSection("QBittorrent").Get<QBittorrentConfig>();
            Assert.NotNull(qb);
            Assert.Equal("http://localhost:18080", qb!.BaseUrl);
            Assert.Equal("u", qb.UserName);
            Assert.Equal("p", qb.Password);

            var everything = config.GetSection("Everything").Get<EverythingConfig>();
            Assert.NotNull(everything);
            Assert.Equal("http://localhost:8888", everything!.BaseUrl);
            Assert.Equal("eu", everything.UserName);
            Assert.Equal("ep", everything.Password);

            var loc = new LocalizationService(config);
            Assert.Equal("zh", loc.CurrentCulture.TwoLetterISOLanguageName);
        }
        finally
        {
            if (File.Exists(appSettingsPath))
                File.Delete(appSettingsPath);
        }
    }

    private static (Dictionary<string, string> Overrides, string[] RemainingArgs) InvokeExtractConfigurationOverrides(string[] args)
    {
        var programType = typeof(AppInfo).Assembly.GetType("JavManager.Program");
        var method = programType?.GetMethod("ExtractConfigurationOverrides", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var result = method!.Invoke(null, new object?[] { args });
        Assert.NotNull(result);

        return ((Dictionary<string, string> Overrides, string[] RemainingArgs))result!;
    }

    private static IConfiguration InvokeBuildConfiguration(IReadOnlyDictionary<string, string>? overrides)
    {
        var programType = typeof(AppInfo).Assembly.GetType("JavManager.Program");
        var method = programType?.GetMethod("BuildConfiguration", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var config = method!.Invoke(null, new object?[] { overrides });
        Assert.NotNull(config);

        return (IConfiguration)config!;
    }
}

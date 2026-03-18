using System.Reflection;

namespace JavManager.Utils;

public static class AppInfo
{
    public const string Name = "JavManager";

    public static string Version
    {
        get
        {
            var assembly = Assembly.GetEntryAssembly() ?? typeof(AppInfo).Assembly;

            var informational = assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
                ?.InformationalVersion;

            if (!string.IsNullOrWhiteSpace(informational))
                return informational;

            var version = assembly.GetName().Version?.ToString();
            return string.IsNullOrWhiteSpace(version) ? "unknown" : version;
        }
    }
}


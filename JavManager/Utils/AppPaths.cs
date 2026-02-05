namespace JavManager.Utils;

public static class AppPaths
{
    public static string GetPreferredConfigDirectory()
    {
        var appHostDir = TryGetAppHostDirectory();
        if (!string.IsNullOrWhiteSpace(appHostDir))
            return appHostDir;

        return AppContext.BaseDirectory;
    }

    public static string GetAppSettingsPath()
        => Path.Combine(GetPreferredConfigDirectory(), "appsettings.json");

    private static string? TryGetAppHostDirectory()
    {
        var processPath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(processPath))
            return null;

        var fileName = Path.GetFileName(processPath);
        if (!fileName.Equals(AppInfo.Name, StringComparison.OrdinalIgnoreCase) &&
            !fileName.Equals($"{AppInfo.Name}.exe", StringComparison.OrdinalIgnoreCase))
            return null;

        return Path.GetDirectoryName(processPath);
    }
}


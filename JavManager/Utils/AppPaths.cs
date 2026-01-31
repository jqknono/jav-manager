namespace JavManager.Utils;

public static class AppPaths
{
    public static string GetPreferredConfigDirectory()
    {
        var mobileAppDataDir = TryGetMobileAppDataDirectory();
        if (!string.IsNullOrWhiteSpace(mobileAppDataDir))
            return mobileAppDataDir;

        var appHostDir = TryGetAppHostDirectory();
        if (!string.IsNullOrWhiteSpace(appHostDir))
            return appHostDir;

        return AppContext.BaseDirectory;
    }

    public static string GetAppSettingsPath()
        => Path.Combine(GetPreferredConfigDirectory(), "appsettings.json");

    private static string? TryGetMobileAppDataDirectory()
    {
        // Android packages are read-only; configuration must live in app-private storage.
        if (!OperatingSystem.IsAndroid())
            return null;

        var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (string.IsNullOrWhiteSpace(baseDir))
            baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        if (string.IsNullOrWhiteSpace(baseDir))
            baseDir = Environment.GetFolderPath(Environment.SpecialFolder.Personal);

        if (string.IsNullOrWhiteSpace(baseDir))
            return null;

        return Path.Combine(baseDir, AppInfo.Name);
    }

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


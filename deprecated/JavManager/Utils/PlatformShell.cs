using System.Diagnostics;

namespace JavManager.Utils;

public static class PlatformShell
{
    public static void OpenContainingFolder(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return;

        try
        {
            var fullPath = Path.GetFullPath(path);

            if (OperatingSystem.IsWindows())
            {
                var args = $"/select,\"{fullPath}\"";
                Process.Start(new ProcessStartInfo("explorer.exe", args)
                {
                    UseShellExecute = true
                });
                return;
            }

            if (OperatingSystem.IsMacOS())
            {
                Process.Start("open", $"-R \"{fullPath}\"");
                return;
            }

            var dir = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrWhiteSpace(dir))
            {
                Process.Start("xdg-open", dir);
            }
        }
        catch
        {
            // ignore: best-effort UX
        }
    }
}


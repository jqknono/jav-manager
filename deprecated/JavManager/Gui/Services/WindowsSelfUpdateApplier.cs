using System.Diagnostics;
using JavManager.Utils;

namespace JavManager.Gui.Services;

public sealed class WindowsSelfUpdateApplier
{
    public bool CanApplyToCurrentProcess(out string reason)
    {
        reason = string.Empty;

        if (!OperatingSystem.IsWindows())
        {
            reason = "Self-update is only supported on Windows right now.";
            return false;
        }

        var processPath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(processPath))
        {
            reason = "Cannot determine process path.";
            return false;
        }

        var fileName = Path.GetFileName(processPath);
        if (!fileName.Equals($"{AppInfo.Name}.exe", StringComparison.OrdinalIgnoreCase))
        {
            reason = "Self-update requires running the published executable (not 'dotnet run').";
            return false;
        }

        return true;
    }

    public void StartReplaceAndRestart(string newExePath, int currentPid)
    {
        var currentExePath = Environment.ProcessPath!;
        var installDir = Path.GetDirectoryName(currentExePath)!;

        var cmdPath = Path.Combine(installDir, $"{AppInfo.Name}.update.{currentPid}.cmd");
        File.WriteAllText(cmdPath, BuildUpdateCmd(currentExePath, newExePath, currentPid));

        var psi = new ProcessStartInfo
        {
            FileName = cmdPath,
            UseShellExecute = true,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            WorkingDirectory = installDir,
        };

        Process.Start(psi);
    }

    private static string BuildUpdateCmd(string currentExePath, string newExePath, int pid)
    {
        // Use CRLF for cmd.
        var nl = "\r\n";
        return
            "@echo off" + nl +
            "setlocal enableextensions" + nl +
            $"set \"PID={pid}\"" + nl +
            $"set \"SRC={newExePath}\"" + nl +
            $"set \"DST={currentExePath}\"" + nl +
            ":wait" + nl +
            "tasklist /FI \"PID eq %PID%\" | findstr /R /C:\"^ *%PID% \" >nul" + nl +
            "if not errorlevel 1 (" + nl +
            "  timeout /t 1 /nobreak >nul" + nl +
            "  goto wait" + nl +
            ")" + nl +
            "timeout /t 1 /nobreak >nul" + nl +
            "move /y \"%SRC%\" \"%DST%\" >nul" + nl +
            "start \"\" \"%DST%\"" + nl +
            "del \"%~f0\"" + nl;
    }
}


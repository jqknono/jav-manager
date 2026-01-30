using System.Runtime.InteropServices;
using System.Text;

namespace JavManager.Utils;

public static class ConsoleHost
{
    public static void EnsureConsole()
    {
        if (!OperatingSystem.IsWindows())
            return;

        if (HasConsole())
            return;

        try
        {
            // If the process already has redirected stdio (common under `dotnet run`/CI),
            // don't create a new console window; just ensure Console streams are bound.
            if (Console.IsInputRedirected || Console.IsOutputRedirected || Console.IsErrorRedirected)
            {
                RebindStandardIo();
                return;
            }

            if (!AttachConsole(ATTACH_PARENT_PROCESS))
                _ = AllocConsole();

            RebindStandardIo();
        }
        catch
        {
            // ignore: console attach should never block startup
        }
    }

    private static bool HasConsole()
        => GetConsoleWindow() != IntPtr.Zero;

    private static void RebindStandardIo()
    {
        try
        {
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), Encoding.UTF8) { AutoFlush = true });
            Console.SetError(new StreamWriter(Console.OpenStandardError(), Encoding.UTF8) { AutoFlush = true });
            Console.SetIn(new StreamReader(Console.OpenStandardInput(), Encoding.UTF8));
        }
        catch
        {
            // ignore
        }
    }

    private const uint ATTACH_PARENT_PROCESS = 0xFFFFFFFF;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AttachConsole(uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AllocConsole();

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();
}

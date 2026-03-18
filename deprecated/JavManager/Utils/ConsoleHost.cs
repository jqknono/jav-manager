using System.Runtime.InteropServices;
using System.Text;

namespace JavManager.Utils;

public static class ConsoleHost
{
    private delegate bool ConsoleCtrlDelegate(uint ctrlType);
    private static ConsoleCtrlDelegate? _consoleCtrlHandler;

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

    public static void IgnoreCtrlC()
    {
        if (!OperatingSystem.IsWindows())
            return;

        try
        {
            // Swallow Ctrl+C at the native console control-handler layer so it can't
            // trigger shutdown behavior (e.g., via Console.CancelKeyPress handlers or frameworks).
            // This is intended for GUI mode when the app is launched via `dotnet run`/VS Code tasks.
            _consoleCtrlHandler ??= ctrlType => ctrlType is CTRL_C_EVENT or CTRL_BREAK_EVENT;
            _ = SetConsoleCtrlHandler(_consoleCtrlHandler, add: true);
        }
        catch
        {
            // ignore
        }
    }

    public static void DetachConsoleIfAttached()
    {
        if (!OperatingSystem.IsWindows())
            return;

        if (!HasConsole())
            return;

        try
        {
            _ = FreeConsole();
        }
        catch
        {
            // ignore
        }

        try
        {
            // After detaching, ensure Console I/O calls don't throw.
            Console.SetOut(TextWriter.Null);
            Console.SetError(TextWriter.Null);
            Console.SetIn(TextReader.Null);
        }
        catch
        {
            // ignore
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
    private const uint CTRL_C_EVENT = 0;
    private const uint CTRL_BREAK_EVENT = 1;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AttachConsole(uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AllocConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate? handler, bool add);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();
}

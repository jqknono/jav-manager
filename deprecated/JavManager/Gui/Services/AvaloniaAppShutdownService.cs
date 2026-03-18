using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;

namespace JavManager.Gui.Services;

public interface IAppShutdownService
{
    void Shutdown();
}

public sealed class AvaloniaAppShutdownService : IAppShutdownService
{
    public void Shutdown()
    {
        if (Avalonia.Application.Current?.ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.Shutdown();
            return;
        }

        Environment.Exit(0);
    }
}

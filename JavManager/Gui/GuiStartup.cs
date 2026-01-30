using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using JavManager.Gui.ViewModels;
using JavManager.Gui.Views;
using Microsoft.Extensions.DependencyInjection;

namespace JavManager.Gui;

public static class GuiStartup
{
    public static void Run(IServiceProvider services)
    {
        BuildAvaloniaApp(services)
            .StartWithClassicDesktopLifetime(Array.Empty<string>());
    }

    public static AppBuilder BuildAvaloniaApp(IServiceProvider services) =>
        AppBuilder.Configure(() => new App(services))
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}

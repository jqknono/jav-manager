using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using JavManager.Gui.Views;
using JavManager.Gui.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using AppBase = Avalonia.Application;

namespace JavManager.Gui;

public partial class App : AppBase
{
    private IServiceProvider? _services;

    public App()
    {
        _services = null;
    }

    public App(IServiceProvider services)
    {
        _services = services;
    }

    private IServiceProvider Services
        => _services ??= GuiServiceProviderFactory.Create();

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        var services = Services;

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow
            {
                DataContext = services.GetRequiredService<MainViewModel>()
            };
        }
        else if (ApplicationLifetime is ISingleViewApplicationLifetime singleView)
        {
            singleView.MainView = new MainView
            {
                DataContext = services.GetRequiredService<MainViewModel>()
            };
        }

        base.OnFrameworkInitializationCompleted();
    }
}

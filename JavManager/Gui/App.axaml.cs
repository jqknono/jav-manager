using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
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
            var mainVm = services.GetRequiredService<MainViewModel>();
            desktop.MainWindow = new MainWindow
            {
                DataContext = mainVm
            };

            // Background update check (if enabled) without blocking startup.
            Dispatcher.UIThread.Post(
                async () => await mainVm.SettingsViewModel.PerformUpdateCheckIfEnabledAsync(),
                DispatcherPriority.Background);
        }
        else if (ApplicationLifetime is ISingleViewApplicationLifetime singleView)
        {
            var mainVm = services.GetRequiredService<MainViewModel>();
            singleView.MainView = new MainView
            {
                DataContext = mainVm
            };

            Dispatcher.UIThread.Post(
                async () => await mainVm.SettingsViewModel.PerformUpdateCheckIfEnabledAsync(),
                DispatcherPriority.Background);
        }

        base.OnFrameworkInitializationCompleted();
    }
}

using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
using JavManager.Gui.Views;
using JavManager.Gui.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using System.Text;
using AppBase = Avalonia.Application;

namespace JavManager.Gui;

public partial class App : AppBase
{
    private IServiceProvider? _services;
    private MainView? _mainView;
    private bool _singleViewInitialized;

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

    private static void TryLogUnhandledException(string source, Exception exception)
    {
        try
        {
            var logsDir = Path.Combine(AppContext.BaseDirectory, "logs");
            Directory.CreateDirectory(logsDir);

            var logPath = Path.Combine(logsDir, "gui-unhandled.log");
            var sb = new StringBuilder();
            sb.AppendLine("----");
            sb.AppendLine($"{DateTimeOffset.Now:O} [{source}]");
            sb.AppendLine(exception.ToString());
            File.AppendAllText(logPath, sb.ToString());
        }
        catch
        {
            // ignore
        }
    }

    public override void OnFrameworkInitializationCompleted()
    {
        var services = Services;

        Dispatcher.UIThread.UnhandledException += (_, e) =>
        {
            TryLogUnhandledException("Dispatcher.UIThread", e.Exception);
        };

        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            if (e.ExceptionObject is Exception ex)
                TryLogUnhandledException("AppDomain", ex);
        };

        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            TryLogUnhandledException("TaskScheduler", e.Exception);
        };

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var mainVm = services.GetRequiredService<MainViewModel>();
            desktop.MainWindow = new MainWindow
            {
                DataContext = mainVm
            };

            // Background update check (if enabled) without blocking startup.
            Dispatcher.UIThread.Post(
                () => _ = mainVm.SettingsViewModel.PerformUpdateCheckIfEnabledSafeAsync(),
                DispatcherPriority.Background);
        }
        else if (ApplicationLifetime is ISingleViewApplicationLifetime singleView)
        {
            // For Android/iOS: OnFrameworkInitializationCompleted may be called multiple times
            // when the Activity is recreated (e.g., rotation, back from background).
            // We must reuse the same MainView instance to avoid "already has a visual parent" errors.
            if (!_singleViewInitialized)
            {
                var mainVm = services.GetRequiredService<MainViewModel>();
                _mainView = new MainView { DataContext = mainVm };
                _singleViewInitialized = true;

                Dispatcher.UIThread.Post(
                    () => _ = mainVm.SettingsViewModel.PerformUpdateCheckIfEnabledSafeAsync(),
                    DispatcherPriority.Background);
            }

            // Detach from old parent if necessary before re-assigning
            if (_mainView?.Parent is { } oldParent && oldParent is ContentControl cc)
            {
                cc.Content = null;
            }

            singleView.MainView = _mainView;
        }

        base.OnFrameworkInitializationCompleted();
    }
}

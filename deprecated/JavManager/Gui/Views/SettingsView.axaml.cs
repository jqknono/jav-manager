using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
using JavManager.Gui.ViewModels;

namespace JavManager.Gui.Views;

public partial class SettingsView : UserControl
{
    public SettingsView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object? sender, RoutedEventArgs e)
    {
        if (DataContext is SettingsViewModel viewModel)
        {
            // Kick off health checks after the UI has a chance to render.
            Dispatcher.UIThread.Post(
                async () => await viewModel.PerformHealthCheckAsync(),
                DispatcherPriority.Background);
        }
    }
}

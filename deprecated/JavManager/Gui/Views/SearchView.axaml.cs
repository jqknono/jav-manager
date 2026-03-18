using Avalonia.Controls;
using Avalonia.Input;
using JavManager.Gui.ViewModels;
using System.ComponentModel;

namespace JavManager.Gui.Views;

public partial class SearchView : UserControl
{
    public SearchViewModel? ViewModel => DataContext as SearchViewModel;
    private SearchViewModel? _subscribedViewModel;

    public SearchView()
    {
        InitializeComponent();
        SizeChanged += (_, _) => UpdateResponsiveClasses();
        UpdateResponsiveClasses();
    }

    protected override void OnDataContextChanged(EventArgs e)
    {
        base.OnDataContextChanged(e);

        if (_subscribedViewModel != null)
            _subscribedViewModel.PropertyChanged -= OnViewModelPropertyChanged;

        _subscribedViewModel = ViewModel;
        if (_subscribedViewModel != null)
            _subscribedViewModel.PropertyChanged += OnViewModelPropertyChanged;

        UpdateResponsiveClasses();
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(SearchViewModel.SearchLocal) ||
            e.PropertyName == nameof(SearchViewModel.SearchRemote))
        {
            UpdateResponsiveClasses();
        }
    }

    private void UpdateResponsiveClasses()
    {
        const double twoPaneWidthThreshold = 880;

        var vm = ViewModel;
        var hasLocal = vm?.SearchLocal == true;
        var hasRemote = vm?.SearchRemote == true;

        Classes.Set("has-local", hasLocal);
        Classes.Set("has-remote", hasRemote);
        Classes.Set("two-pane", Bounds.Width >= twoPaneWidthThreshold && hasLocal && hasRemote);
    }
}

using Avalonia.Controls;
using Avalonia.Input;
using JavManager.Gui.ViewModels;

namespace JavManager.Gui.Views;

public partial class SearchView : UserControl
{
    public SearchViewModel? ViewModel => DataContext as SearchViewModel;

    public SearchView()
    {
        InitializeComponent();
    }
}

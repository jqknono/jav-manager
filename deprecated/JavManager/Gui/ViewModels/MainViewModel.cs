using CommunityToolkit.Mvvm.ComponentModel;
using JavManager.Gui.Localization;
using JavManager.Localization;
using JavManager.Utils;

namespace JavManager.Gui.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    private readonly LocalizationService _loc;

    public GuiLocalization Loc { get; }

    [ObservableProperty]
    private ViewModelBase _currentPage;

    [ObservableProperty]
    private int _selectedTabIndex;

    public SearchViewModel SearchViewModel { get; }
    public DownloadsViewModel DownloadsViewModel { get; }
    public SettingsViewModel SettingsViewModel { get; }

    public string Title => $"{AppInfo.Name} v{AppInfo.Version}";

    public MainViewModel(
        SearchViewModel searchViewModel,
        DownloadsViewModel downloadsViewModel,
        SettingsViewModel settingsViewModel,
        GuiLocalization guiLocalization,
        LocalizationService localizationService)
    {
        SearchViewModel = searchViewModel;
        DownloadsViewModel = downloadsViewModel;
        SettingsViewModel = settingsViewModel;
        Loc = guiLocalization;
        _loc = localizationService;
        _currentPage = searchViewModel;
    }

    partial void OnSelectedTabIndexChanged(int value)
    {
        CurrentPage = value switch
        {
            0 => SearchViewModel,
            1 => DownloadsViewModel,
            2 => SettingsViewModel,
            _ => SearchViewModel
        };

        // Auto-refresh downloads when switching to downloads tab
        if (value == 1)
        {
            _ = DownloadsViewModel.RefreshAsync();
        }
    }
}

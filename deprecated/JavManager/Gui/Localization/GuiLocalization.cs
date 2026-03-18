using System.ComponentModel;
using CommunityToolkit.Mvvm.ComponentModel;
using JavManager.Localization;

namespace JavManager.Gui.Localization;

public sealed class GuiLocalization : ObservableObject
{
    private readonly LocalizationService _loc;

    public GuiLocalization(LocalizationService localizationService)
    {
        _loc = localizationService;
        _loc.LanguageChanged += OnLanguageChanged;
    }

    public string this[string key] => _loc.Get(key);

    private void OnLanguageChanged(object? sender, EventArgs e)
    {
        // Avalonia bindings to indexers listen for PropertyChanged on "Item" (and sometimes "Item[]").
        // Also raise an empty name to indicate "everything changed".
        OnPropertyChanged(string.Empty);
        OnPropertyChanged(new PropertyChangedEventArgs("Item"));
        OnPropertyChanged(new PropertyChangedEventArgs("Item[]"));
    }
}

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Gui.Localization;
using JavManager.Core.Interfaces;
using JavManager.Gui.Services;
using JavManager.Localization;
using JavManager.Services;

namespace JavManager.Gui.ViewModels;

public partial class SettingsViewModel : ViewModelBase
{
    private readonly EverythingConfig _everythingConfig;
    private readonly QBittorrentConfig _qbConfig;
    private readonly JavDbConfig _javDbConfig;
    private readonly DownloadConfig _downloadConfig;
    private readonly LocalizationService _loc;
    private readonly GuiConfigFileService _configFileService;
    private readonly HealthCheckService _healthCheckService;

    public GuiLocalization Loc { get; }

    // Everything settings
    [ObservableProperty]
    private string _everythingBaseUrl = string.Empty;

    [ObservableProperty]
    private string _everythingUserName = string.Empty;

    [ObservableProperty]
    private string _everythingPassword = string.Empty;

    // qBittorrent settings
    [ObservableProperty]
    private string _qbBaseUrl = string.Empty;

    [ObservableProperty]
    private string _qbUserName = string.Empty;

    [ObservableProperty]
    private string _qbPassword = string.Empty;

    // JavDB settings
    [ObservableProperty]
    private string _javDbBaseUrl = string.Empty;

    // Download settings
    [ObservableProperty]
    private string _defaultSavePath = string.Empty;

    [ObservableProperty]
    private string _defaultCategory = string.Empty;

    [ObservableProperty]
    private string _defaultTags = string.Empty;

    // Language
    [ObservableProperty]
    private string _selectedLanguage = "en";

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _isTesting;

    // Health status
    [ObservableProperty]
    private string _everythingStatus = "Unknown";

    [ObservableProperty]
    private string _qbStatus = "Unknown";

    [ObservableProperty]
    private string _javDbStatus = "Unknown";

    public string[] AvailableLanguages { get; } = { "en", "zh" };

    public SettingsViewModel(
        EverythingConfig everythingConfig,
        QBittorrentConfig qbConfig,
        JavDbConfig javDbConfig,
        DownloadConfig downloadConfig,
        GuiLocalization guiLocalization,
        LocalizationService localizationService,
        GuiConfigFileService configFileService,
        HealthCheckService healthCheckService)
    {
        _everythingConfig = everythingConfig;
        _qbConfig = qbConfig;
        _javDbConfig = javDbConfig;
        _downloadConfig = downloadConfig;
        Loc = guiLocalization;
        _loc = localizationService;
        _configFileService = configFileService;
        _healthCheckService = healthCheckService;

        LoadSettings();
    }

    private void LoadSettings()
    {
        // Everything
        EverythingBaseUrl = _everythingConfig.BaseUrl ?? string.Empty;
        EverythingUserName = _everythingConfig.UserName ?? string.Empty;
        EverythingPassword = _everythingConfig.Password ?? string.Empty;

        // qBittorrent
        QbBaseUrl = _qbConfig.BaseUrl ?? string.Empty;
        QbUserName = _qbConfig.UserName ?? string.Empty;
        QbPassword = _qbConfig.Password ?? string.Empty;

        // JavDB
        JavDbBaseUrl = _javDbConfig.BaseUrl ?? string.Empty;

        // Download
        DefaultSavePath = _downloadConfig.DefaultSavePath ?? string.Empty;
        DefaultCategory = _downloadConfig.DefaultCategory ?? string.Empty;
        DefaultTags = _downloadConfig.DefaultTags ?? string.Empty;

        // Language
        SelectedLanguage = _loc.CurrentCulture.TwoLetterISOLanguageName;
    }

    partial void OnSelectedLanguageChanged(string value)
    {
        _loc.SetLanguage(value);
    }

    [RelayCommand]
    private async Task ApplySettingsAsync()
    {
        // Everything
        _everythingConfig.BaseUrl = EverythingBaseUrl;
        _everythingConfig.UserName = string.IsNullOrWhiteSpace(EverythingUserName) ? null : EverythingUserName;
        _everythingConfig.Password = string.IsNullOrWhiteSpace(EverythingPassword) ? null : EverythingPassword;

        // qBittorrent
        _qbConfig.BaseUrl = QbBaseUrl;
        _qbConfig.UserName = string.IsNullOrWhiteSpace(QbUserName) ? null : QbUserName;
        _qbConfig.Password = string.IsNullOrWhiteSpace(QbPassword) ? null : QbPassword;

        // JavDB
        _javDbConfig.BaseUrl = JavDbBaseUrl;

        // Download
        _downloadConfig.DefaultSavePath = DefaultSavePath;
        _downloadConfig.DefaultCategory = DefaultCategory;
        _downloadConfig.DefaultTags = DefaultTags;

        // Language
        _loc.SetLanguage(SelectedLanguage);

        try
        {
            await _configFileService.SaveAsync(
                _everythingConfig,
                _qbConfig,
                _javDbConfig,
                _downloadConfig,
                SelectedLanguage);

            StatusMessage = _loc.Get(L.ConfigUpdated);
        }
        catch (Exception ex)
        {
            StatusMessage = _loc.GetFormat("ErrorOccurred", ex.Message);
        }
    }

    [RelayCommand]
    private async Task TestConnectionsAsync()
    {
        IsTesting = true;
        StatusMessage = "Testing connections...";

        try
        {
            // Apply settings first
            await ApplySettingsAsync();

            var results = await _healthCheckService.CheckAllAsync();

            foreach (var r in results)
            {
                var status = r.IsHealthy ? "OK" : r.Message;
                if (r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase))
                    EverythingStatus = status;
                else if (r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase))
                    QbStatus = status;
                else if (r.ServiceName.Contains("JavDB", StringComparison.OrdinalIgnoreCase))
                    JavDbStatus = status;
            }

            var healthy = results.Count(r => r.IsHealthy);
            StatusMessage = $"{healthy}/{results.Count} services healthy";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Test failed: {ex.Message}";
        }
        finally
        {
            IsTesting = false;
        }
    }

    [RelayCommand]
    private void ResetSettings()
    {
        LoadSettings();
        StatusMessage = _loc.Get("Gui_Settings_StatusReset");
    }
}

using System;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Gui.Localization;
using JavManager.Core.Interfaces;
using JavManager.Gui.Services;
using JavManager.Gui.Utils;
using JavManager.Localization;
using JavManager.Services;

namespace JavManager.Gui.ViewModels;

public partial class SettingsViewModel : ViewModelBase
{
    private readonly EverythingConfig _everythingConfig;
    private readonly QBittorrentConfig _qbConfig;
    private readonly JavDbConfig _javDbConfig;
    private readonly DownloadConfig _downloadConfig;
    private readonly TelemetryConfig _telemetryConfig;
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

    [ObservableProperty]
    private string _javDbMirrorUrls = string.Empty;

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
    private LanguageOption? _selectedLanguageOption;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _isUpdatingJavDbDomain;

    [ObservableProperty]
    private bool _isTesting;

    // Health status
    [ObservableProperty]
    private string _everythingStatus = "Unknown";

    [ObservableProperty]
    private string? _everythingStatusDetails;

    [ObservableProperty]
    private string _qbStatus = "Unknown";

    [ObservableProperty]
    private string? _qbStatusDetails;

    [ObservableProperty]
    private string _javDbStatus = "Unknown";

    [ObservableProperty]
    private string? _javDbStatusDetails;

    public IReadOnlyList<LanguageOption> AvailableLanguages { get; }

    public SettingsViewModel(
        EverythingConfig everythingConfig,
        QBittorrentConfig qbConfig,
        JavDbConfig javDbConfig,
        DownloadConfig downloadConfig,
        TelemetryConfig telemetryConfig,
        GuiLocalization guiLocalization,
        LocalizationService localizationService,
        GuiConfigFileService configFileService,
        HealthCheckService healthCheckService)
    {
        _everythingConfig = everythingConfig;
        _qbConfig = qbConfig;
        _javDbConfig = javDbConfig;
        _downloadConfig = downloadConfig;
        _telemetryConfig = telemetryConfig;
        Loc = guiLocalization;
        _loc = localizationService;
        AvailableLanguages = new[]
        {
            new LanguageOption("en", "Gui_Settings_Language_English", localizationService),
            new LanguageOption("zh", "Gui_Settings_Language_Chinese", localizationService),
        };
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
        JavDbMirrorUrls = string.Join(",", _javDbConfig.MirrorUrls ?? new List<string>());

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
        SelectedLanguageOption = AvailableLanguages.FirstOrDefault(
            option => string.Equals(option.Code, value, StringComparison.OrdinalIgnoreCase));
    }

    partial void OnSelectedLanguageOptionChanged(LanguageOption? value)
    {
        if (value == null)
            return;

        if (!string.Equals(SelectedLanguage, value.Code, StringComparison.OrdinalIgnoreCase))
        {
            SelectedLanguage = value.Code;
        }
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
        _javDbConfig.MirrorUrls = ParseMirrorUrls(JavDbMirrorUrls);

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
                var (summary, details) = r.IsHealthy
                    ? ("OK", string.Empty)
                    : UiMessageFormatter.ToSummaryAndDetails(r.Message);

                var status = r.IsHealthy ? "OK" : summary;
                if (r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase))
                {
                    EverythingStatus = status;
                    EverythingStatusDetails = r.IsHealthy || string.IsNullOrWhiteSpace(details) ? null : details;
                }
                else if (r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase))
                {
                    QbStatus = status;
                    QbStatusDetails = r.IsHealthy || string.IsNullOrWhiteSpace(details) ? null : details;
                }
                else if (r.ServiceName.Contains("JavDB", StringComparison.OrdinalIgnoreCase))
                {
                    JavDbStatus = status;
                    JavDbStatusDetails = r.IsHealthy || string.IsNullOrWhiteSpace(details) ? null : details;
                }
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

    /// <summary>
    /// 静默执行健康检查，不更新状态消息（用于页面加载时自动检查）
    /// </summary>
    public async Task PerformHealthCheckAsync()
    {
        try
        {
            var results = await _healthCheckService.CheckAllAsync();

            foreach (var r in results)
            {
                var (summary, details) = r.IsHealthy
                    ? ("OK", string.Empty)
                    : UiMessageFormatter.ToSummaryAndDetails(r.Message);

                var status = r.IsHealthy ? "OK" : summary;
                if (r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase))
                {
                    EverythingStatus = status;
                    EverythingStatusDetails = r.IsHealthy || string.IsNullOrWhiteSpace(details) ? null : details;
                }
                else if (r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase))
                {
                    QbStatus = status;
                    QbStatusDetails = r.IsHealthy || string.IsNullOrWhiteSpace(details) ? null : details;
                }
                else if (r.ServiceName.Contains("JavDB", StringComparison.OrdinalIgnoreCase))
                {
                    JavDbStatus = status;
                    JavDbStatusDetails = r.IsHealthy || string.IsNullOrWhiteSpace(details) ? null : details;
                }
            }
        }
        catch
        {
            // 静默失败，不影响用户体验
        }
    }

    [RelayCommand]
    private async Task UpdateJavDbDomainAsync()
    {
        IsUpdatingJavDbDomain = true;
        StatusMessage = _loc.Get("Gui_Settings_UpdatingJavDbDomain");

        try
        {
            // 从 Telemetry API 获取最新域名列表
            var apiEndpoint = string.IsNullOrWhiteSpace(_telemetryConfig.Endpoint)
                ? "https://jav-manager-telemetry.workers.dev"
                : _telemetryConfig.Endpoint.TrimEnd('/');

            var response = await new HttpClient().GetAsync($"{apiEndpoint}/api/javdb-domain");
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var result = System.Text.Json.Nodes.JsonNode.Parse(content);

            if (result != null
                && result["success"]?.GetValue<bool>() == true
                && result["domains"] is System.Text.Json.Nodes.JsonArray domainsArray
                && domainsArray.Count > 0)
            {
                var domains = domainsArray
                    .Select(d => d?.ToString())
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Select(d => d!.Trim())
                    .ToList();

                if (domains.Count == 0)
                {
                    StatusMessage = $"{_loc.Get("Gui_Settings_JavDbDomainUpdateFailed")}: No valid domains";
                    return;
                }

                // 所有域名作为镜像，BaseUrl 保持不变
                var mirrorDomains = domains
                    .Select(d => d.StartsWith("http") ? d : $"https://{d}")
                    .ToList();
                JavDbMirrorUrls = string.Join(",", mirrorDomains);

                await ApplySettingsAsync();

                var mirrorDisplay = string.Join(", ", domains);
                StatusMessage = _loc.GetFormat("Gui_Settings_JavDbMirrorUrlsUpdated", mirrorDisplay);
            }
            else
            {
                StatusMessage = $"{_loc.Get("Gui_Settings_JavDbDomainUpdateFailed")}: Invalid API response";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"{_loc.Get("Gui_Settings_JavDbDomainUpdateFailed")}: {ex.Message}";
        }
        finally
        {
            IsUpdatingJavDbDomain = false;
        }
    }

    private static List<string> ParseMirrorUrls(string commaSeparated)
    {
        if (string.IsNullOrWhiteSpace(commaSeparated))
            return new List<string>();

        return commaSeparated.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Select(url => url.Trim())
            .ToList();
    }

    public sealed class LanguageOption : ObservableObject
    {
        private readonly LocalizationService _localizationService;
        private readonly string _labelKey;

        public LanguageOption(string code, string labelKey, LocalizationService localizationService)
        {
            Code = code;
            _labelKey = labelKey;
            _localizationService = localizationService;
            _localizationService.LanguageChanged += OnLanguageChanged;
        }

        public string Code { get; }

        public string DisplayName => _localizationService.Get(_labelKey);

        private void OnLanguageChanged(object? sender, EventArgs e)
        {
            OnPropertyChanged(nameof(DisplayName));
        }
    }
}

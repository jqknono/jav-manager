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
using JavManager.Utils;

namespace JavManager.Gui.ViewModels;

public partial class SettingsViewModel : ViewModelBase
{
    private readonly EverythingConfig _everythingConfig;
    private readonly QBittorrentConfig _qbConfig;
    private readonly JavDbConfig _javDbConfig;
    private readonly DownloadConfig _downloadConfig;
    private readonly TelemetryConfig _telemetryConfig;
    private readonly UpdateConfig _updateConfig;
    private readonly LocalizationService _loc;
    private readonly GuiConfigFileService _configFileService;
    private readonly HealthCheckService _healthCheckService;
    private readonly AppUpdateService _appUpdateService;
    private readonly WindowsSelfUpdateApplier _windowsSelfUpdateApplier;
    private readonly IAppShutdownService _shutdownService;

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

    [ObservableProperty]
    private bool _isCheckingUpdates;

    [ObservableProperty]
    private bool _isUpdatingApp;

    [ObservableProperty]
    private bool _autoUpdateEnabled = true;

    [ObservableProperty]
    private string _updateStatus = "Unknown";

    [ObservableProperty]
    private string? _updateStatusDetails;

    [ObservableProperty]
    private bool _canUpdateNow;

    [ObservableProperty]
    private bool _canCheckUpdates = true;

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
        UpdateConfig updateConfig,
        GuiLocalization guiLocalization,
        LocalizationService localizationService,
        GuiConfigFileService configFileService,
        HealthCheckService healthCheckService,
        AppUpdateService appUpdateService,
        WindowsSelfUpdateApplier windowsSelfUpdateApplier,
        IAppShutdownService shutdownService)
    {
        _everythingConfig = everythingConfig;
        _qbConfig = qbConfig;
        _javDbConfig = javDbConfig;
        _downloadConfig = downloadConfig;
        _telemetryConfig = telemetryConfig;
        _updateConfig = updateConfig;
        Loc = guiLocalization;
        _loc = localizationService;
        AvailableLanguages = new[]
        {
            new LanguageOption("en", "Gui_Settings_Language_English", localizationService),
            new LanguageOption("zh", "Gui_Settings_Language_Chinese", localizationService),
            new LanguageOption("ja", "Gui_Settings_Language_Japanese", localizationService),
            new LanguageOption("ko", "Gui_Settings_Language_Korean", localizationService),
        };
        _configFileService = configFileService;
        _healthCheckService = healthCheckService;
        _appUpdateService = appUpdateService;
        _windowsSelfUpdateApplier = windowsSelfUpdateApplier;
        _shutdownService = shutdownService;

        LoadSettings();
        InitializeUpdateStatus();
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

        // Update
        AutoUpdateEnabled = _updateConfig.AutoCheckOnStartup;
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

        // Update
        _updateConfig.AutoCheckOnStartup = AutoUpdateEnabled;

        try
        {
            await _configFileService.SaveAsync(
                _everythingConfig,
                _qbConfig,
                _javDbConfig,
                _downloadConfig,
                _updateConfig,
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

    [RelayCommand]
    private async Task CheckUpdatesAsync()
    {
        await CheckUpdatesInternalAsync(showToasts: true);
    }

    private AppUpdateService.AppUpdateCheckResult? _lastUpdateCheck;

    private bool CanUpdateNowExecute()
        => CanUpdateNow;

    [RelayCommand(CanExecute = nameof(CanUpdateNowExecute))]
    private async Task UpdateNowAsync()
    {
        if (_lastUpdateCheck?.HasUpdate != true || _lastUpdateCheck.Asset == null)
        {
            await CheckUpdatesInternalAsync(showToasts: true);
        }

        if (_lastUpdateCheck?.HasUpdate != true || _lastUpdateCheck.Asset == null)
        {
            StatusMessage = _loc.Get("Gui_Settings_Update_NoUpdate");
            return;
        }

        if (!_windowsSelfUpdateApplier.CanApplyToCurrentProcess(out var reason))
        {
            StatusMessage = _loc.GetFormat("Gui_Settings_Update_NotSupported", reason);
            return;
        }

        IsUpdatingApp = true;
        UpdateCanUpdateNow();
        StatusMessage = _loc.Get("Gui_Settings_Update_Downloading");

        try
        {
            var asset = _lastUpdateCheck.Asset;
            var installDir = Path.GetDirectoryName(Environment.ProcessPath!)!;

            var tempDir = Path.Combine(installDir, ".update");
            Directory.CreateDirectory(tempDir);

            var expectedExeName = $"{AppInfo.Name}.exe";
            var downloadedPath = Path.Combine(tempDir, asset.Name);
            var newExePath = Path.Combine(tempDir, expectedExeName + ".new");

            await _appUpdateService.DownloadAssetToFileAsync(asset, downloadedPath, cancellationToken: default);

            if (asset.IsZip)
            {
                var ok = AppUpdateService.TryExtractSingleFileFromZip(downloadedPath, expectedExeName, newExePath);
                if (!ok)
                {
                    StatusMessage = _loc.GetFormat("Gui_Settings_Update_Failed", "Zip missing expected executable.");
                    return;
                }
            }
            else
            {
                // Direct exe download
                File.Copy(downloadedPath, newExePath, overwrite: true);
            }

            // Quick sanity check: Windows PE header.
            using (var fs = File.OpenRead(newExePath))
            {
                var header = new byte[2];
                var read = fs.Read(header, 0, 2);
                if (read != 2 || header[0] != (byte)'M' || header[1] != (byte)'Z')
                    throw new InvalidDataException("Downloaded file is not a valid Windows executable.");
            }

            var currentExe = Environment.ProcessPath!;
            var finalNewExePath = Path.Combine(Path.GetDirectoryName(currentExe)!, $"{AppInfo.Name}.exe.new");
            File.Copy(newExePath, finalNewExePath, overwrite: true);

            StatusMessage = _loc.Get("Gui_Settings_Update_Installing");
            _windowsSelfUpdateApplier.StartReplaceAndRestart(finalNewExePath, Environment.ProcessId);

            // Shut down so the updater script can replace the executable.
            _shutdownService.Shutdown();
        }
        catch (Exception ex)
        {
            StatusMessage = _loc.GetFormat("Gui_Settings_Update_Failed", ex.Message);
        }
        finally
        {
            IsUpdatingApp = false;
            UpdateCanUpdateNow();
        }
    }

    public async Task PerformUpdateCheckIfEnabledAsync()
    {
        if (!_updateConfig.Enabled || !_updateConfig.AutoCheckOnStartup)
            return;

        await CheckUpdatesInternalAsync(showToasts: false);
    }

    public async Task PerformUpdateCheckIfEnabledSafeAsync()
    {
        try
        {
            await PerformUpdateCheckIfEnabledAsync().ConfigureAwait(false);
        }
        catch
        {
            // Never crash the app due to background update checks (especially on mobile).
        }
    }

    private void InitializeUpdateStatus()
    {
        if (!_updateConfig.Enabled)
        {
            UpdateStatus = _loc.Get("Gui_Settings_Update_Disabled");
            UpdateCanUpdateNow();
            return;
        }

        UpdateStatus = _loc.Get("Gui_Settings_Update_Unknown");
        UpdateCanUpdateNow();
    }

    private async Task CheckUpdatesInternalAsync(bool showToasts)
    {
        if (!_updateConfig.Enabled)
        {
            UpdateStatus = _loc.Get("Gui_Settings_Update_Disabled");
            if (showToasts)
                StatusMessage = _loc.Get("Gui_Settings_Update_Disabled");
            return;
        }

        IsCheckingUpdates = true;
        UpdateCanUpdateNow();
        UpdateStatus = _loc.Get("Gui_Settings_Update_Checking");
        UpdateStatusDetails = null;

        try
        {
            var result = await _appUpdateService.CheckForUpdatesAsync();
            _lastUpdateCheck = result;
            UpdateCanUpdateNow();

            if (!result.IsSuccess)
            {
                UpdateStatus = _loc.Get("Gui_Settings_Update_CheckFailed");
                UpdateStatusDetails = result.Error;
                if (showToasts)
                    StatusMessage = _loc.GetFormat("Gui_Settings_Update_Failed", result.Error ?? "Unknown error");
                return;
            }

            if (result.HasUpdate)
            {
                UpdateStatus = _loc.GetFormat("Gui_Settings_Update_Available", result.LatestVersion);
                UpdateStatusDetails = result.ReleasePageUrl;
                if (showToasts)
                    StatusMessage = _loc.GetFormat("Gui_Settings_Update_Available", result.LatestVersion);
            }
            else
            {
                UpdateStatus = _loc.GetFormat("Gui_Settings_Update_UpToDate", result.CurrentVersion);
                if (showToasts)
                    StatusMessage = _loc.Get("Gui_Settings_Update_NoUpdate");
            }
        }
        catch (Exception ex)
        {
            UpdateStatus = _loc.Get("Gui_Settings_Update_CheckFailed");
            UpdateStatusDetails = ex.Message;
            if (showToasts)
                StatusMessage = _loc.GetFormat("Gui_Settings_Update_Failed", ex.Message);
        }
        finally
        {
            IsCheckingUpdates = false;
            UpdateCanUpdateNow();
        }
    }

    partial void OnIsCheckingUpdatesChanged(bool value) => UpdateCanUpdateNow();

    partial void OnIsUpdatingAppChanged(bool value) => UpdateCanUpdateNow();

    private void UpdateCanUpdateNow()
    {
        CanCheckUpdates = _updateConfig.Enabled && !IsCheckingUpdates && !IsUpdatingApp;

        // Allow "Update Now" to run a check first; it will no-op if no update is available.
        CanUpdateNow = _updateConfig.Enabled && !IsCheckingUpdates && !IsUpdatingApp;
        UpdateNowCommand.NotifyCanExecuteChanged();
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

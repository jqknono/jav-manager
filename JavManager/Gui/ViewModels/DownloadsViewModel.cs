using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JavManager.Core.Interfaces;
using JavManager.Gui.Localization;
using JavManager.Localization;
using JavManager.Services;

namespace JavManager.Gui.ViewModels;

public partial class DownloadsViewModel : ViewModelBase
{
    private readonly IQBittorrentClient _qbClient;
    private readonly LocalizationService _loc;

    public GuiLocalization Loc { get; }

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _showDownloadingOnly = true;

    public ObservableCollection<DownloadItem> Downloads { get; } = new();

    public DownloadsViewModel(
        IQBittorrentClient qbClient,
        GuiLocalization guiLocalization,
        LocalizationService localizationService)
    {
        _qbClient = qbClient;
        Loc = guiLocalization;
        _loc = localizationService;
    }

    [RelayCommand]
    public async Task RefreshAsync()
    {
        IsLoading = true;
        Downloads.Clear();

        try
        {
            var torrents = await _qbClient.GetTorrentsAsync();
            var list = ShowDownloadingOnly
                ? torrents.Where(t =>
                    !string.IsNullOrWhiteSpace(t.State) &&
                    (t.State.Contains("downloading", StringComparison.OrdinalIgnoreCase) ||
                     t.State.Contains("stalleddl", StringComparison.OrdinalIgnoreCase) ||
                     t.State.Contains("metadl", StringComparison.OrdinalIgnoreCase)))
                  .ToList()
                : torrents;

            foreach (var t in list)
            {
                Downloads.Add(new DownloadItem
                {
                    Name = t.Name ?? t.Title ?? "Unknown",
                    State = t.State ?? "Unknown",
                    Progress = t.Progress ?? 0,
                    Size = FormatSize(t.Size),
                    DownloadSpeed = FormatSpeed(t.DlSpeed),
                    Eta = FormatEta(t.Eta)
                });
            }

            StatusMessage = _loc.GetFormat("Gui_Downloads_StatusCount", Downloads.Count);
        }
        catch (Exception ex)
        {
            StatusMessage = _loc.GetFormat(L.DownloaderException, ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    partial void OnShowDownloadingOnlyChanged(bool value)
    {
        _ = RefreshAsync();
    }

    private static string FormatSize(long bytes)
    {
        if (bytes <= 0) return "-";
        if (bytes >= 1024L * 1024 * 1024)
            return $"{bytes / 1024.0 / 1024 / 1024:F2} GB";
        if (bytes >= 1024 * 1024)
            return $"{bytes / 1024.0 / 1024:F2} MB";
        return $"{bytes / 1024.0:F2} KB";
    }

    private static string FormatSpeed(long bytesPerSecond)
    {
        if (bytesPerSecond <= 0) return "-";
        if (bytesPerSecond >= 1024 * 1024)
            return $"{bytesPerSecond / 1024.0 / 1024:F2} MB/s";
        return $"{bytesPerSecond / 1024.0:F2} KB/s";
    }

    private static string FormatEta(long seconds)
    {
        if (seconds <= 0 || seconds >= 8640000) return "-";
        var ts = TimeSpan.FromSeconds(seconds);
        if (ts.TotalHours >= 1)
            return $"{(int)ts.TotalHours}h {ts.Minutes}m";
        if (ts.TotalMinutes >= 1)
            return $"{ts.Minutes}m {ts.Seconds}s";
        return $"{ts.Seconds}s";
    }
}

public class DownloadItem
{
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public double Progress { get; set; }
    public string Size { get; set; } = string.Empty;
    public string DownloadSpeed { get; set; } = string.Empty;
    public string Eta { get; set; } = string.Empty;

    public string ProgressText => $"{Progress * 100:F1}%";
}

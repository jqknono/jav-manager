using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Gui.Localization;
using JavManager.Localization;
using JavManager.Services;
using JavManager.Utils;

namespace JavManager.Gui.ViewModels;

public partial class SearchViewModel : ViewModelBase
{
    private readonly IJavDbDataProvider _javDbProvider;
    private readonly IJavLocalCacheProvider? _cacheProvider;
    private readonly IEverythingSearchProvider _everythingProvider;
    private readonly TorrentSelectionService _torrentSelectionService;
    private readonly DownloadService _downloadService;
    private readonly TorrentNameParser _nameParser;
    private readonly LocalizationService _loc;
    private readonly IJavInfoTelemetryClient _javInfoTelemetryClient;

    public GuiLocalization Loc { get; }

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private bool _isSearching;

    [ObservableProperty]
    private bool _searchLocal = true;

    [ObservableProperty]
    private bool _searchRemote = true;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private JavSearchResult? _selectedResult;

    [ObservableProperty]
    private TorrentInfo? _selectedTorrent;

    public ObservableCollection<TorrentInfo> SearchResults { get; } = new();

    public ObservableCollection<LocalFileInfo> LocalFiles { get; } = new();

    public SearchViewModel(
        IJavDbDataProvider javDbProvider,
        IEverythingSearchProvider everythingProvider,
        TorrentSelectionService torrentSelectionService,
        DownloadService downloadService,
        TorrentNameParser nameParser,
        GuiLocalization guiLocalization,
        LocalizationService localizationService,
        IJavInfoTelemetryClient javInfoTelemetryClient,
        IJavLocalCacheProvider? cacheProvider = null)
    {
        _javDbProvider = javDbProvider;
        _everythingProvider = everythingProvider;
        _torrentSelectionService = torrentSelectionService;
        _downloadService = downloadService;
        _nameParser = nameParser;
        Loc = guiLocalization;
        _loc = localizationService;
        _javInfoTelemetryClient = javInfoTelemetryClient;
        _cacheProvider = cacheProvider;
    }

    [RelayCommand]
    private async Task SearchAsync()
    {
        if (string.IsNullOrWhiteSpace(SearchQuery))
            return;

        IsSearching = true;
        StatusMessage = _loc.GetFormat(L.Searching, SearchQuery);
        SearchResults.Clear();
        LocalFiles.Clear();
        SelectedResult = null;
        SelectedTorrent = null;

        try
        {
            var normalizedId = _nameParser.NormalizeJavId(SearchQuery);

            // Search local files if enabled
            if (SearchLocal)
            {
                try
                {
                    var localResults = await _everythingProvider.SearchAsync(normalizedId);
                    var filtered = localResults.Where(f => f.Size >= 100 * 1024 * 1024).ToList();
                    foreach (var file in filtered)
                    {
                        LocalFiles.Add(file);
                    }
                }
                catch
                {
                    // Everything search failed, continue with remote
                }
            }

            // Search remote/cache if enabled
            if (SearchRemote)
            {
                JavSearchResult? result = null;

                // Try cache first
                if (_cacheProvider != null)
                {
                    result = await _cacheProvider.GetAsync(normalizedId);
                    if (result != null)
                    {
                        if (string.IsNullOrWhiteSpace(result.JavId))
                            result.JavId = normalizedId;

                        _javInfoTelemetryClient.TryReport(result);
                    }
                }

                // If not in cache, search remote
                if (result == null || result.Torrents.Count == 0)
                {
                    var candidates = await _javDbProvider.SearchCandidatesAsync(normalizedId);
                    if (candidates.Count > 0)
                    {
                        result = await _javDbProvider.GetDetailAsync(candidates[0].DetailUrl);
                        if (result != null)
                        {
                            result.JavId = normalizedId;
                            if (_cacheProvider != null)
                            {
                                await _cacheProvider.SaveAsync(result);
                            }
                        }

                        if (result != null && !string.IsNullOrWhiteSpace(result.JavId))
                        {
                            _javInfoTelemetryClient.TryReport(result);
                        }
                    }
                }

                if (result != null)
                {
                    SelectedResult = result;
                    var sorted = _torrentSelectionService.GetSortedTorrents(result.Torrents);
                    foreach (var torrent in sorted)
                    {
                        SearchResults.Add(torrent);
                    }
                }
            }

            if (SearchResults.Count == 0 && LocalFiles.Count == 0)
            {
                StatusMessage = _loc.Get(L.NoSearchResults);
            }
            else
            {
                var parts = new List<string>();
                if (SearchResults.Count > 0)
                    parts.Add($"{SearchResults.Count} torrents");
                if (LocalFiles.Count > 0)
                    parts.Add($"{LocalFiles.Count} local files");
                StatusMessage = string.Join(", ", parts);
            }
        }
        catch (Exception ex)
        {
            StatusMessage = _loc.GetFormat(L.SearchFailed, ex.Message);
        }
        finally
        {
            IsSearching = false;
        }
    }

    [RelayCommand]
    private async Task DownloadSelectedAsync()
    {
        if (SelectedTorrent == null)
            return;

        try
        {
            StatusMessage = _loc.Get(L.LogStartDownload);
            var success = await _downloadService.AddDownloadAsync(SelectedTorrent);
            if (success)
            {
                StatusMessage = _loc.GetFormat(L.LogDownloadTaskAddedWithTitle, SelectedTorrent.Title);
            }
            else
            {
                StatusMessage = _loc.Get(L.LogAddToQueueFailedShowingMagnet);
            }
        }
        catch (Exception ex)
        {
            StatusMessage = _loc.GetFormat(L.DownloaderException, ex.Message);
        }
    }

    [RelayCommand]
    private void CopyMagnetLink()
    {
        if (SelectedTorrent?.MagnetLink != null)
        {
            // Clipboard will be handled by the view
            StatusMessage = _loc.Get("Gui_Search_StatusMagnetCopied");
        }
    }

    [RelayCommand]
    private void OpenLocalFileFolder(LocalFileInfo? file)
    {
        if (file == null)
            return;

        PlatformShell.OpenContainingFolder(file.FullPath);
    }
}

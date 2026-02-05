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
    private int _remoteDetailLoadVersion;
    private string _lastNormalizedQuery = string.Empty;

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
    private JavSearchResult? _selectedCandidate;

    [ObservableProperty]
    private TorrentInfo? _selectedTorrent;

    [ObservableProperty]
    private bool _isLoadingRemoteDetail;

    public ObservableCollection<TorrentInfo> SearchResults { get; } = new();

    public ObservableCollection<LocalFileInfo> LocalFiles { get; } = new();

    public ObservableCollection<JavSearchResult> RemoteCandidates { get; } = new();

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
        _remoteDetailLoadVersion++;
        IsLoadingRemoteDetail = false;
        SearchResults.Clear();
        LocalFiles.Clear();
        RemoteCandidates.Clear();
        SelectedResult = null;
        SelectedCandidate = null;
        SelectedTorrent = null;

        try
        {
            var normalizedId = _nameParser.NormalizeJavId(SearchQuery);
            _lastNormalizedQuery = normalizedId;

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
                // Try cache first (best-effort)
                JavSearchResult? cached = null;

                if (_cacheProvider != null)
                {
                    cached = await _cacheProvider.GetAsync(normalizedId);
                    if (cached != null)
                    {
                        if (string.IsNullOrWhiteSpace(cached.JavId))
                            cached.JavId = normalizedId;

                        _javInfoTelemetryClient.TryReport(cached);
                    }
                }

                if (cached != null)
                {
                    // Show cached entry as a selectable "search result"
                    RemoteCandidates.Add(cached);
                }
                else
                {
                    // Search remote candidates (do not auto-select; user chooses, then we load torrents)
                    var candidates = await _javDbProvider.SearchCandidatesAsync(normalizedId);
                    foreach (var c in candidates)
                    {
                        RemoteCandidates.Add(c);
                    }
                }
            }

            if (RemoteCandidates.Count == 0 && LocalFiles.Count == 0)
            {
                StatusMessage = _loc.Get(L.NoSearchResults);
            }
            else
            {
                var parts = new List<string>();
                if (RemoteCandidates.Count > 0)
                    parts.Add(_loc.GetFormat("Gui_Search_StatusCountRemoteResults", RemoteCandidates.Count));
                if (LocalFiles.Count > 0)
                    parts.Add(_loc.GetFormat("Gui_Search_StatusCountLocalFiles", LocalFiles.Count));
                var summary = string.Join(", ", parts);
                StatusMessage = RemoteCandidates.Count > 0
                    ? $"{summary}. {_loc.Get("Gui_Search_StatusSelectRemoteResult")}"
                    : summary;
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

    partial void OnSelectedCandidateChanged(JavSearchResult? value)
    {
        if (value == null)
            return;

        // Fire-and-forget; version check prevents stale updates.
        _ = LoadRemoteDetailAsync(value);
    }

    [RelayCommand]
    private void BackToResults()
    {
        SelectedTorrent = null;
        SelectedResult = null;
        SearchResults.Clear();
        SelectedCandidate = null;
        IsLoadingRemoteDetail = false;
        _remoteDetailLoadVersion++;

        if (RemoteCandidates.Count > 0)
            StatusMessage = _loc.Get("Gui_Search_StatusSelectRemoteResult");
    }

    [RelayCommand]
    private void SelectCandidate(JavSearchResult? candidate)
    {
        if (candidate != null)
            SelectedCandidate = candidate;
    }

    [RelayCommand]
    private void SelectTorrent(TorrentInfo? torrent)
    {
        if (torrent != null)
            SelectedTorrent = torrent;
    }

    private async Task LoadRemoteDetailAsync(JavSearchResult candidate)
    {
        var version = ++_remoteDetailLoadVersion;

        SelectedTorrent = null;
        SearchResults.Clear();
        IsLoadingRemoteDetail = true;
        StatusMessage = _loc.Get("Gui_Search_StatusLoadingTorrents");

        try
        {
            JavSearchResult detail;
            if (candidate.Torrents.Count > 0)
            {
                detail = candidate;
            }
            else
            {
                detail = await _javDbProvider.GetDetailAsync(candidate.DetailUrl);
            }

            if (version != _remoteDetailLoadVersion)
                return;

            var inferredId = _nameParser.NormalizeJavId(
                !string.IsNullOrWhiteSpace(candidate.JavId) ? candidate.JavId : candidate.Title);
            if (string.IsNullOrWhiteSpace(inferredId))
                inferredId = _lastNormalizedQuery;

            if (string.IsNullOrWhiteSpace(detail.JavId))
                detail.JavId = inferredId;
            if (string.IsNullOrWhiteSpace(detail.DetailUrl))
                detail.DetailUrl = candidate.DetailUrl;

            SelectedResult = detail;

            if (!string.IsNullOrWhiteSpace(detail.JavId))
                _javInfoTelemetryClient.TryReport(detail);

            if (_cacheProvider != null)
            {
                try
                {
                    await _cacheProvider.SaveAsync(detail);
                }
                catch
                {
                    // Cache failures should not block UI flow
                }
            }

            var sorted = _torrentSelectionService.GetSortedTorrents(detail.Torrents);
            foreach (var torrent in sorted)
            {
                SearchResults.Add(torrent);
            }

            StatusMessage = SearchResults.Count == 0
                ? _loc.Get(L.NoTorrentsFound)
                : _loc.GetFormat("Gui_Search_StatusCountTorrents", SearchResults.Count);
        }
        catch (Exception ex)
        {
            if (version != _remoteDetailLoadVersion)
                return;

            StatusMessage = _loc.GetFormat(L.SearchFailed, ex.Message);
        }
        finally
        {
            if (version == _remoteDetailLoadVersion)
                IsLoadingRemoteDetail = false;
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

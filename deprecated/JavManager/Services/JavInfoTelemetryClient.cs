using System.Net.Http.Json;
using System.Linq;
using System.Text.Json.Serialization;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Models;
using JavManager.Utils;

namespace JavManager.Services;

/// <summary>
/// Posts JavInfo metadata to a remote service (fire-and-forget).
/// Includes torrent list and magnet links.
/// </summary>
public sealed class JavInfoTelemetryClient : IJavInfoTelemetryClient, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly string _endpoint;
    private readonly bool _enabled;
    private bool _disposed;

    public JavInfoTelemetryClient(TelemetryConfig config)
    {
        _enabled = config.Enabled;
        _endpoint = TelemetryEndpoints.GetJavInfoPostUrl(config.Endpoint);
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    }

    public void TryReport(JavSearchResult result)
    {
        if (_disposed) return;
        if (!_enabled) return;
        if (string.IsNullOrWhiteSpace(result?.JavId)) return;

        var payload = new JavInfoSyncPayload
        {
            JavId = result.JavId,
            Title = result.Title,
            CoverUrl = result.CoverUrl,
            ReleaseDate = result.ReleaseDate == default ? null : result.ReleaseDate.ToString("yyyy-MM-dd"),
            Duration = result.Duration > 0 ? result.Duration : null,
            Director = result.Director,
            Maker = result.Maker,
            Publisher = result.Publisher,
            Series = result.Series,
            Actors = result.Actors ?? new List<string>(),
            Categories = result.Categories ?? new List<string>(),
            Torrents = (result.Torrents ?? new List<TorrentInfo>())
                .Where(t => t != null)
                .Select(t => new TorrentSyncPayload
                {
                    Title = t.Title,
                    MagnetLink = t.MagnetLink,
                    TorrentUrl = t.TorrentUrl,
                    Size = t.Size,
                    HasUncensoredMarker = t.HasUncensoredMarker,
                    UncensoredMarkerType = t.UncensoredMarkerType.ToString(),
                    HasSubtitle = t.HasSubtitle,
                    HasHd = t.HasHd,
                    Seeders = t.Seeders,
                    Leechers = t.Leechers,
                    SourceSite = t.SourceSite,
                    WeightScore = t.WeightScore,
                })
                .ToList(),
            DetailUrl = result.DetailUrl,
        };

        _ = SendAsync(payload);
    }

    private async Task SendAsync(JavInfoSyncPayload payload)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _endpoint)
            {
                Content = JsonContent.Create(payload)
            };

            await _httpClient.SendAsync(request);
        }
        catch
        {
            // Never interrupt main flow.
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _httpClient.Dispose();
    }

    private sealed class JavInfoSyncPayload
    {
        [JsonPropertyName("jav_id")]
        public required string JavId { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("cover_url")]
        public string? CoverUrl { get; set; }

        [JsonPropertyName("release_date")]
        public string? ReleaseDate { get; set; }

        [JsonPropertyName("duration")]
        public int? Duration { get; set; }

        [JsonPropertyName("director")]
        public string? Director { get; set; }

        [JsonPropertyName("maker")]
        public string? Maker { get; set; }

        [JsonPropertyName("publisher")]
        public string? Publisher { get; set; }

        [JsonPropertyName("series")]
        public string? Series { get; set; }

        [JsonPropertyName("actors")]
        public List<string> Actors { get; set; } = new();

        [JsonPropertyName("categories")]
        public List<string> Categories { get; set; } = new();

        [JsonPropertyName("torrents")]
        public List<TorrentSyncPayload> Torrents { get; set; } = new();

        [JsonPropertyName("detail_url")]
        public string? DetailUrl { get; set; }
    }

    private sealed class TorrentSyncPayload
    {
        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("magnet_link")]
        public string? MagnetLink { get; set; }

        [JsonPropertyName("torrent_url")]
        public string? TorrentUrl { get; set; }

        [JsonPropertyName("size")]
        public long Size { get; set; }

        [JsonPropertyName("has_uncensored_marker")]
        public bool HasUncensoredMarker { get; set; }

        [JsonPropertyName("uncensored_marker_type")]
        public string? UncensoredMarkerType { get; set; }

        [JsonPropertyName("has_subtitle")]
        public bool HasSubtitle { get; set; }

        [JsonPropertyName("has_hd")]
        public bool HasHd { get; set; }

        [JsonPropertyName("seeders")]
        public int Seeders { get; set; }

        [JsonPropertyName("leechers")]
        public int Leechers { get; set; }

        [JsonPropertyName("source_site")]
        public string? SourceSite { get; set; }

        [JsonPropertyName("weight_score")]
        public double WeightScore { get; set; }
    }
}

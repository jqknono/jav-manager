using System.IO.Compression;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Utils;

namespace JavManager.Services;

public sealed class AppUpdateService : IDisposable
{
    private readonly UpdateConfig _config;
    private readonly HttpClient _httpClient;
    private bool _disposed;

    public AppUpdateService(UpdateConfig config)
    {
        _config = config;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        _httpClient.DefaultRequestHeaders.UserAgent.Clear();
        _httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue(AppInfo.Name, AppInfo.Version));
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        _httpClient.DefaultRequestHeaders.TryAddWithoutValidation("X-GitHub-Api-Version", "2022-11-28");
    }

    public async Task<AppUpdateCheckResult> CheckForUpdatesAsync(CancellationToken cancellationToken = default)
    {
        if (_disposed)
            return AppUpdateCheckResult.Failed("Updater disposed.");

        if (!_config.Enabled)
            return AppUpdateCheckResult.Disabled(AppInfo.Version);

        var repo = string.IsNullOrWhiteSpace(_config.GitHubRepo) ? "jqknono/jav-manager" : _config.GitHubRepo.Trim();
        var url = $"https://api.github.com/repos/{repo}/releases/latest";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var body = await TryReadBodyAsync(response, cancellationToken).ConfigureAwait(false);
            var msg = $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}";
            if (!string.IsNullOrWhiteSpace(body))
                msg = $"{msg}: {body}";
            return AppUpdateCheckResult.Failed(msg);
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        var release = await JsonSerializer.DeserializeAsync<GitHubRelease>(
            stream,
            JsonOptions,
            cancellationToken).ConfigureAwait(false);

        if (release == null || string.IsNullOrWhiteSpace(release.TagName))
            return AppUpdateCheckResult.Failed("Invalid release response.");

        var currentVersion = NormalizeTagOrVersion(AppInfo.Version);
        var latestVersion = NormalizeTagOrVersion(release.TagName);

        var hasUpdate = IsNewerVersion(latestVersion, currentVersion);
        var rid = GetCurrentRidOrNull();
        var asset = SelectAssetOrNull(release.Assets ?? new List<GitHubAsset>(), rid);

        return new AppUpdateCheckResult(
            CurrentVersion: currentVersion,
            LatestVersion: latestVersion,
            HasUpdate: hasUpdate,
            ReleasePageUrl: release.HtmlUrl,
            Asset: asset,
            Error: null);
    }

    public async Task DownloadAssetToFileAsync(
        AppUpdateAsset asset,
        string destinationFilePath,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(AppUpdateService));

        Directory.CreateDirectory(Path.GetDirectoryName(destinationFilePath)!);

        using var request = new HttpRequestMessage(HttpMethod.Get, asset.DownloadUrl);
        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength;
        await using var source = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);

        var tempPath = destinationFilePath + ".partial";
        await using (var target = File.Create(tempPath))
        {
            await CopyWithProgressAsync(source, target, totalBytes, progress, cancellationToken).ConfigureAwait(false);
        }

        if (File.Exists(destinationFilePath))
            File.Delete(destinationFilePath);

        File.Move(tempPath, destinationFilePath);
    }

    public static bool TryExtractSingleFileFromZip(
        string zipPath,
        string expectedFileName,
        string destinationFilePath)
    {
        using var zip = ZipFile.OpenRead(zipPath);

        var entry = zip.Entries.FirstOrDefault(e =>
            string.Equals(Path.GetFileName(e.FullName), expectedFileName, StringComparison.OrdinalIgnoreCase));

        if (entry == null)
            return false;

        Directory.CreateDirectory(Path.GetDirectoryName(destinationFilePath)!);
        if (File.Exists(destinationFilePath))
            File.Delete(destinationFilePath);

        entry.ExtractToFile(destinationFilePath, overwrite: true);
        return true;
    }

    public static string NormalizeTagOrVersion(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "unknown";

        var trimmed = value.Trim();
        if (trimmed.StartsWith("v", StringComparison.OrdinalIgnoreCase) && trimmed.Length > 1)
            trimmed = trimmed[1..];

        return trimmed;
    }

    public static bool IsNewerVersion(string? candidate, string? baseline)
    {
        if (!TryParseLooseVersion(candidate, out var cand))
            return false;
        if (!TryParseLooseVersion(baseline, out var baseVer))
            return false;
        return cand > baseVer;
    }

    public static bool TryParseLooseVersion(string? value, out Version version)
    {
        version = new Version(0, 0, 0, 0);
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var trimmed = value.Trim();
        var dash = trimmed.IndexOf('-', StringComparison.Ordinal);
        if (dash >= 0)
            trimmed = trimmed[..dash];

        var plus = trimmed.IndexOf('+', StringComparison.Ordinal);
        if (plus >= 0)
            trimmed = trimmed[..plus];

        trimmed = trimmed.Trim();
        if (trimmed.StartsWith("v", StringComparison.OrdinalIgnoreCase) && trimmed.Length > 1)
            trimmed = trimmed[1..];

        if (!Version.TryParse(trimmed, out var parsed) || parsed == null)
            return false;

        version = parsed;
        return true;
    }

    public static string? GetCurrentRidOrNull()
    {
        Architecture arch = RuntimeInformation.OSArchitecture;

        if (OperatingSystem.IsWindows())
        {
            return arch switch
            {
                Architecture.X64 => "win-x64",
                Architecture.Arm64 => "win-arm64",
                _ => null
            };
        }

        if (OperatingSystem.IsLinux())
        {
            return arch switch
            {
                Architecture.X64 => "linux-x64",
                Architecture.Arm64 => "linux-arm64",
                _ => null
            };
        }

        if (OperatingSystem.IsMacOS())
        {
            return arch switch
            {
                Architecture.X64 => "osx-x64",
                Architecture.Arm64 => "osx-arm64",
                _ => null
            };
        }

        return null;
    }

    public static AppUpdateAsset? SelectAssetOrNull(IReadOnlyList<GitHubAsset> assets, string? rid)
    {
        if (assets.Count == 0 || string.IsNullOrWhiteSpace(rid))
            return null;

        var candidates = assets
            .Where(a => !string.IsNullOrWhiteSpace(a.Name) && a.DownloadUrl != null)
            .Select(a => new { Asset = a, Score = ScoreAsset(a.Name!, rid) })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .Select(x => x.Asset)
            .ToList();

        if (candidates.Count == 0)
            return null;

        var best = candidates[0];
        return new AppUpdateAsset(best.Name!, best.DownloadUrl!, best.Size, IsZip(best.Name!));
    }

    private static int ScoreAsset(string name, string rid)
    {
        var n = name.ToLowerInvariant();
        var r = rid.ToLowerInvariant();

        if (!n.Contains(r))
            return 0;

        var score = 10;
        if (n.StartsWith("javmanager"))
            score += 10;
        if (IsZip(name))
            score += 2;

        if (r.StartsWith("win-") && n.EndsWith(".exe"))
            score += 10;
        if (!r.StartsWith("win-") && !Path.HasExtension(name))
            score += 6;

        return score;
    }

    private static bool IsZip(string name)
        => name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase);

    private static async Task CopyWithProgressAsync(
        Stream source,
        Stream destination,
        long? totalBytes,
        IProgress<double>? progress,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[1024 * 64];
        long totalRead = 0;
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken).ConfigureAwait(false)) > 0)
        {
            await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
            totalRead += read;

            if (progress != null && totalBytes.HasValue && totalBytes.Value > 0)
            {
                progress.Report(Math.Clamp((double)totalRead / totalBytes.Value, 0, 1));
            }
        }
    }

    private static async Task<string?> TryReadBodyAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            body = body.Trim();
            return string.IsNullOrWhiteSpace(body) ? null : body;
        }
        catch
        {
            return null;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _httpClient.Dispose();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public sealed record AppUpdateAsset(string Name, Uri DownloadUrl, long Size, bool IsZip);

    public sealed record AppUpdateCheckResult(
        string CurrentVersion,
        string LatestVersion,
        bool HasUpdate,
        string? ReleasePageUrl,
        AppUpdateAsset? Asset,
        string? Error)
    {
        public bool IsSuccess => string.IsNullOrWhiteSpace(Error);

        public static AppUpdateCheckResult Disabled(string currentVersion)
            => new(currentVersion, "unknown", HasUpdate: false, ReleasePageUrl: null, Asset: null, Error: null);

        public static AppUpdateCheckResult Failed(string error)
            => new(NormalizeTagOrVersion(AppInfo.Version), "unknown", HasUpdate: false, ReleasePageUrl: null, Asset: null, Error: error);
    }

    private sealed class GitHubRelease
    {
        [JsonPropertyName("tag_name")]
        public string? TagName { get; set; }

        [JsonPropertyName("html_url")]
        public string? HtmlUrl { get; set; }

        [JsonPropertyName("assets")]
        public List<GitHubAsset>? Assets { get; set; }
    }

    public sealed class GitHubAsset
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("browser_download_url")]
        public Uri? DownloadUrl { get; set; }

        [JsonPropertyName("size")]
        public long Size { get; set; }
    }
}

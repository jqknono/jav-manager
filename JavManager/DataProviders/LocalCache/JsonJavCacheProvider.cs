using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;

namespace JavManager.DataProviders.LocalCache;

/// <summary>
/// JSON 文件本地缓存提供者（替代 SQLite）
/// </summary>
public sealed class JsonJavCacheProvider : IJavLocalCacheProvider
{
    private readonly LocalCacheConfig _config;
    private readonly string _cacheFilePath;
    private readonly JsonSerializerOptions _jsonOptions;

    public JsonJavCacheProvider(LocalCacheConfig config)
    {
        _config = config;
        var baseDir = GetPreferredBaseDirectory();
        _cacheFilePath = ResolveCacheFilePath(baseDir, config.DatabasePath);

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task InitializeAsync()
    {
        var dir = Path.GetDirectoryName(_cacheFilePath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        if (!File.Exists(_cacheFilePath))
        {
            await WriteStoreAsync(new CacheStore());
        }
    }

    public async Task<JavSearchResult?> GetAsync(string javId)
    {
        var key = NormalizeJavId(javId);
        if (string.IsNullOrWhiteSpace(key))
            return null;

        var store = await ReadStoreAsync();
        if (!store.Items.TryGetValue(key, out var value) || value == null)
            return null;

        if (IsExpired(value))
        {
            store.Items.Remove(key);
            await WriteStoreAsync(store);
            return null;
        }

        Sanitize(value);
        value.JavId = key;
        value.DataSource = "Local";
        return value;
    }

    public async Task SaveAsync(JavSearchResult result)
    {
        var key = NormalizeJavId(result.JavId);
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("JavId is required.", nameof(result));

        result.JavId = key;
        result.CachedAt = DateTime.UtcNow;
        Sanitize(result);

        var store = await ReadStoreAsync();
        store.Items[key] = result;
        await WriteStoreAsync(store);
    }

    public async Task UpdateTorrentsAsync(string javId, List<TorrentInfo> torrents)
    {
        var key = NormalizeJavId(javId);
        if (string.IsNullOrWhiteSpace(key))
            return;

        var store = await ReadStoreAsync();
        if (!store.Items.TryGetValue(key, out var existing) || existing == null)
            return;

        existing.Torrents = torrents ?? new List<TorrentInfo>();
        existing.CachedAt = DateTime.UtcNow;
        Sanitize(existing);

        store.Items[key] = existing;
        await WriteStoreAsync(store);
    }

    public async Task<bool> ExistsAsync(string javId)
    {
        var key = NormalizeJavId(javId);
        if (string.IsNullOrWhiteSpace(key))
            return false;

        var store = await ReadStoreAsync();
        if (!store.Items.TryGetValue(key, out var value) || value == null)
            return false;

        if (IsExpired(value))
        {
            store.Items.Remove(key);
            await WriteStoreAsync(store);
            return false;
        }

        return true;
    }

    public async Task DeleteAsync(string javId)
    {
        var key = NormalizeJavId(javId);
        if (string.IsNullOrWhiteSpace(key))
            return;

        var store = await ReadStoreAsync();
        if (store.Items.Remove(key))
        {
            await WriteStoreAsync(store);
        }
    }

    public async Task<CacheStatistics> GetStatisticsAsync()
    {
        var store = await ReadStoreAsync();
        var expiredKeys = new List<string>();

        var torrentCount = 0;
        DateTime? lastUpdatedAt = null;

        foreach (var (key, item) in store.Items)
        {
            if (item == null)
            {
                expiredKeys.Add(key);
                continue;
            }

            if (IsExpired(item))
            {
                expiredKeys.Add(key);
                continue;
            }

            Sanitize(item);
            torrentCount += item.Torrents.Count;

            if (item.CachedAt.HasValue &&
                (!lastUpdatedAt.HasValue || item.CachedAt.Value > lastUpdatedAt.Value))
            {
                lastUpdatedAt = item.CachedAt.Value;
            }
        }

        if (expiredKeys.Count > 0)
        {
            foreach (var k in expiredKeys)
            {
                store.Items.Remove(k);
            }

            await WriteStoreAsync(store);
        }

        var sizeBytes = File.Exists(_cacheFilePath) ? new FileInfo(_cacheFilePath).Length : 0L;

        return new CacheStatistics
        {
            TotalJavCount = store.Items.Count,
            TotalTorrentCount = torrentCount,
            DatabaseSizeBytes = sizeBytes,
            LastUpdatedAt = lastUpdatedAt
        };
    }

    #region Internal helpers

    private bool IsExpired(JavSearchResult result)
    {
        var days = _config.CacheExpirationDays;
        if (days <= 0)
            return false;

        if (!result.CachedAt.HasValue)
            return false;

        return result.CachedAt.Value < DateTime.UtcNow.AddDays(-days);
    }

    private async Task<CacheStore> ReadStoreAsync()
    {
        if (!File.Exists(_cacheFilePath))
            return new CacheStore();

        try
        {
            var json = await File.ReadAllTextAsync(_cacheFilePath);
            if (string.IsNullOrWhiteSpace(json))
                return new CacheStore();

            var store = JsonSerializer.Deserialize<CacheStore>(json, _jsonOptions);
            return store ?? new CacheStore();
        }
        catch
        {
            return new CacheStore();
        }
    }

    private async Task WriteStoreAsync(CacheStore store)
    {
        var dir = Path.GetDirectoryName(_cacheFilePath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        var tmp = _cacheFilePath + ".tmp";
        var json = JsonSerializer.Serialize(store, _jsonOptions);
        await File.WriteAllTextAsync(tmp, json);
        File.Move(tmp, _cacheFilePath, overwrite: true);
    }

    private static void Sanitize(JavSearchResult result)
    {
        result.Actors ??= new List<string>();
        result.Categories ??= new List<string>();
        result.Torrents ??= new List<TorrentInfo>();
    }

    private static string ResolveCacheFilePath(string baseDir, string configuredPath)
    {
        var path = (configuredPath ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(path))
        {
            if (Path.GetExtension(path).Equals(".db", StringComparison.OrdinalIgnoreCase))
            {
                path = Path.ChangeExtension(path, ".json");
            }

            if (!Path.IsPathRooted(path))
            {
                path = Path.Combine(baseDir, path);
            }

            return path;
        }

        return Path.Combine(baseDir, "jav_cache.json");
    }

    private static string GetPreferredBaseDirectory()
    {
        var baseDir = AppContext.BaseDirectory;
        var appHostDir = TryGetAppHostDirectory();
        if (!string.IsNullOrWhiteSpace(appHostDir) && !IsSameDirectory(appHostDir, baseDir))
        {
            return appHostDir;
        }

        return baseDir;
    }

    private static string? TryGetAppHostDirectory()
    {
        var processPath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(processPath))
            return null;

        var expected = Assembly.GetEntryAssembly()?.GetName().Name;
        if (string.IsNullOrWhiteSpace(expected))
            return null;

        var fileName = Path.GetFileName(processPath);
        if (!fileName.Equals(expected, StringComparison.OrdinalIgnoreCase) &&
            !fileName.Equals($"{expected}.exe", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return Path.GetDirectoryName(processPath);
    }

    private static bool IsSameDirectory(string a, string b)
    {
        var pa = Path.GetFullPath(a).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var pb = Path.GetFullPath(b).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return pa.Equals(pb, StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeJavId(string javId)
    {
        if (string.IsNullOrWhiteSpace(javId))
            return string.Empty;

        var normalized = javId.Trim().ToUpperInvariant();
        if (!normalized.Contains('-'))
        {
            var match = Regex.Match(normalized, @"^([A-Z]+)(\d+)$");
            if (match.Success)
            {
                normalized = $"{match.Groups[1].Value}-{match.Groups[2].Value}";
            }
        }

        return normalized;
    }

    private sealed class CacheStore
    {
        public Dictionary<string, JavSearchResult?> Items { get; set; } = new();
    }

    #endregion
}


using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Collections.Concurrent;
using JavManager.Utils;

namespace JavManager.Services;

/// <summary>
/// Collects and sends telemetry data to the remote service.
/// All operations are non-blocking (fire-and-forget).
/// </summary>
public class TelemetryService : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly string _telemetryEndpoint;
    private readonly bool _enabled;
    private readonly TelemetryInfo _info;
    private readonly ConcurrentDictionary<int, Task> _inFlight = new();
    private int _inFlightId;
    private bool _disposed;

    public TelemetryService(string? telemetryEndpoint = null, bool enabled = true)
    {
        // TelemetryConfig.Endpoint is a "base endpoint", but keep compatibility with older full URLs.
        _telemetryEndpoint = TelemetryEndpoints.GetTelemetryPostUrl(telemetryEndpoint);
        _enabled = enabled;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        _info = CollectSystemInfo();
    }

    /// <summary>
    /// Sends a startup event. Non-blocking.
    /// </summary>
    public void TrackStartup()
    {
        SendEvent("startup", null);
    }

    /// <summary>
    /// Sends a search event. Non-blocking.
    /// </summary>
    public void TrackSearch(string? searchTerm = null)
    {
        SendEvent("search", searchTerm != null ? $"term:{searchTerm}" : null);
    }

    /// <summary>
    /// Sends a download event. Non-blocking.
    /// </summary>
    public void TrackDownload(string? javId = null)
    {
        SendEvent("download", javId != null ? $"jav:{javId}" : null);
    }

    /// <summary>
    /// Sends a custom event. Non-blocking.
    /// </summary>
    public void TrackEvent(string eventType, string? eventData = null)
    {
        SendEvent(eventType, eventData);
    }

    private void SendEvent(string eventType, string? eventData)
    {
        if (!_enabled || _disposed) return;

        var payload = new TelemetryPayload
        {
            MachineName = _info.MachineName,
            UserName = _info.UserName,
            AppVersion = _info.AppVersion,
            OsInfo = _info.OsInfo,
            EventType = eventType,
            EventData = eventData
        };

        // Fire-and-forget: start immediately, but keep a handle so a fast process exit
        // still has a chance to flush in Dispose.
        var task = SendAsync(payload);
        var id = Interlocked.Increment(ref _inFlightId);
        _inFlight[id] = task;
        _ = task.ContinueWith(
            _ => _inFlight.TryRemove(new KeyValuePair<int, Task>(id, task)),
            CancellationToken.None,
            TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
    }

    private async Task SendAsync(TelemetryPayload payload)
    {
        try
        {
            await _httpClient.PostAsJsonAsync(_telemetryEndpoint, payload);
        }
        catch
        {
            // Silently ignore errors - telemetry should never interrupt the app
        }
    }

    private static TelemetryInfo CollectSystemInfo()
    {
        var machineName = GetMachineNameSafe();
        var userName = GetUserNameSafe();
        var appVersion = GetAppVersion();
        var osInfo = GetOsInfo();

        return new TelemetryInfo(machineName, userName, appVersion, osInfo);
    }

    private static string GetMachineNameSafe()
    {
        try
        {
            var name = Environment.MachineName;
            if (!string.IsNullOrWhiteSpace(name))
                return name;
        }
        catch
        {
            // Access denied or other error
        }

        // Generate a random machine identifier
        return $"machine-{GenerateRandomId()}";
    }

    private static string GetUserNameSafe()
    {
        try
        {
            var name = Environment.UserName;
            if (!string.IsNullOrWhiteSpace(name))
                return name;
        }
        catch
        {
            // Access denied or other error
        }

        // Generate a random user identifier
        return $"user-{GenerateRandomId()}";
    }

    private static string GetAppVersion()
    {
        try
        {
            var assembly = System.Reflection.Assembly.GetExecutingAssembly();
            var version = assembly.GetName().Version;
            return version?.ToString() ?? "unknown";
        }
        catch
        {
            return "unknown";
        }
    }

    private static string GetOsInfo()
    {
        try
        {
            return $"{Environment.OSVersion.Platform} {Environment.OSVersion.Version}";
        }
        catch
        {
            return "unknown";
        }
    }

    private static string GenerateRandomId()
    {
        // Generate a short random hex string
        var bytes = new byte[4];
        Random.Shared.NextBytes(bytes);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try
        {
            // Best-effort flush: do not hang process shutdown.
            Task.WhenAll(_inFlight.Values).Wait(TimeSpan.FromMilliseconds(750));
        }
        catch
        {
            // ignore
        }

        _httpClient.Dispose();
    }

    private record TelemetryInfo(string MachineName, string UserName, string AppVersion, string OsInfo);

    private class TelemetryPayload
    {
        [JsonPropertyName("machine_name")]
        public required string MachineName { get; set; }

        [JsonPropertyName("user_name")]
        public required string UserName { get; set; }

        [JsonPropertyName("app_version")]
        public string? AppVersion { get; set; }

        [JsonPropertyName("os_info")]
        public string? OsInfo { get; set; }

        [JsonPropertyName("event_type")]
        public string? EventType { get; set; }

        [JsonPropertyName("event_data")]
        public string? EventData { get; set; }
    }
}

namespace JavManager.Core.Configuration.ConfigSections;

/// <summary>
/// Configuration for telemetry collection (user events + javinfo metadata).
/// </summary>
public class TelemetryConfig
{
    /// <summary>
    /// Whether telemetry is enabled. Default: true.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// The telemetry service base endpoint (no trailing /api required).
    /// Example: https://jav-manager.techfetch.dev or http://127.0.0.1:8787
    /// Leave empty to use the default endpoint.
    /// </summary>
    public string? Endpoint { get; set; }
}

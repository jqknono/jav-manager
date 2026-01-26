namespace JavManager.Core.Configuration.ConfigSections;

/// <summary>
/// Configuration for telemetry service.
/// </summary>
public class TelemetryConfig
{
    /// <summary>
    /// Whether telemetry is enabled. Default: true.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// The telemetry endpoint URL. 
    /// Leave empty to use default endpoint.
    /// </summary>
    public string? Endpoint { get; set; }
}

namespace JavManager.Core.Configuration.ConfigSections;

/// <summary>
/// Configuration for syncing JavInfo metadata to a remote service.
/// </summary>
public class JavInfoSyncConfig
{
    /// <summary>
    /// Whether remote JavInfo sync is enabled. Default: false.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// The endpoint URL to POST JavInfo metadata to.
    /// Example: https://jav-manager.techfetch.dev/api/javinfo
    /// </summary>
    public string? Endpoint { get; set; }

    /// <summary>
    /// Optional API key sent via X-API-Key header.
    /// </summary>
    public string? ApiKey { get; set; }
}

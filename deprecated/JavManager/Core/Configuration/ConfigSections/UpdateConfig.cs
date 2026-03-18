namespace JavManager.Core.Configuration.ConfigSections;

/// <summary>
/// Application update settings.
/// </summary>
public sealed class UpdateConfig
{
    /// <summary>
    /// Whether update functionality is enabled. Default: true.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Whether to auto-check for updates on startup. Default: true.
    /// </summary>
    public bool AutoCheckOnStartup { get; set; } = true;

    /// <summary>
    /// GitHub repository in the form "owner/repo". Default: jqknono/jav-manager
    /// </summary>
    public string GitHubRepo { get; set; } = "jqknono/jav-manager";
}


namespace JavManager.Core.Configuration.ConfigSections;

public class QBittorrentConfig
{
    public string BaseUrl { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public string? Password { get; set; }
}

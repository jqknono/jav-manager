namespace JavManager.Core.Configuration.ConfigSections;

public class QBittorrentConfig
{
    public string BaseUrl { get; set; } = "http://localhost:8080";
    public string UserName { get; set; } = "admin";
    public string Password { get; set; } = string.Empty;
}

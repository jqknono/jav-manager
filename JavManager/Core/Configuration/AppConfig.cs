using JavManager.Core.Configuration.ConfigSections;

namespace JavManager.Core.Configuration;

public class AppConfig
{
    public EverythingConfig Everything { get; set; } = new();
    public QBittorrentConfig QBittorrent { get; set; } = new();
    public JavDbConfig JavDb { get; set; } = new();
    public DownloadConfig Download { get; set; } = new();
    public WeightsConfig Weights { get; set; } = new();
}

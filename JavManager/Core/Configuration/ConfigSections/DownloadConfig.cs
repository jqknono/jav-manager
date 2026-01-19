namespace JavManager.Core.Configuration.ConfigSections;

public class DownloadConfig
{
    public string DefaultSavePath { get; set; } = "/downloads/jav";
    public string DefaultCategory { get; set; } = "jav";
    public string DefaultTags { get; set; } = "auto";
    public bool PausedOnStart { get; set; } = false;
}

public class WeightsConfig
{
    public double UncensoredWeight { get; set; } = 1000.0;
    public double SubtitleWeight { get; set; } = 500.0;
}

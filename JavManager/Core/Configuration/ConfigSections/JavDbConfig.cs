namespace JavManager.Core.Configuration.ConfigSections;

public class JavDbCookie
{
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
}

public class JavDbConfig
{
    public string BaseUrl { get; set; } = "https://javdb.com";
    public List<string> MirrorUrls { get; set; } = new();
    public int RequestTimeout { get; set; } = 30000;
}

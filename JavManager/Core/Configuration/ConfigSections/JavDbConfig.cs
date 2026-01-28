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
    
    /// <summary>
    /// Cloudflare cf_clearance cookie value (obtained from browser).
    /// This is required when Cloudflare JavaScript challenge is active.
    /// </summary>
    public string? CfClearance { get; set; }
    
    /// <summary>
    /// Cloudflare __cf_bm cookie value (optional, improves success rate).
    /// </summary>
    public string? CfBm { get; set; }
    
    /// <summary>
    /// User-Agent string to use (should match the browser that obtained the cookies).
    /// </summary>
    public string? UserAgent { get; set; }
}

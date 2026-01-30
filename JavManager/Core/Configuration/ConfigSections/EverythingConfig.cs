namespace JavManager.Core.Configuration.ConfigSections;

public class EverythingConfig
{
    public string BaseUrl { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public string? Password { get; set; }
    public bool UseAuthentication => !string.IsNullOrEmpty(UserName);
}

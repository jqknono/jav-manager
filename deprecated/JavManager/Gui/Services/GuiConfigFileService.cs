using JavManager.Core.Configuration.ConfigSections;
using JavManager.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace JavManager.Gui.Services;

public sealed class GuiConfigFileService
{
    private readonly string _configPath;

    public GuiConfigFileService()
        : this(configPath: null)
    {
    }

    public GuiConfigFileService(string? configPath = null)
    {
        _configPath = string.IsNullOrWhiteSpace(configPath)
            ? AppPaths.GetAppSettingsPath()
            : configPath;
    }

    public string ConfigPath => _configPath;

    public async Task SaveAsync(
        EverythingConfig everythingConfig,
        QBittorrentConfig qBittorrentConfig,
        JavDbConfig javDbConfig,
        DownloadConfig downloadConfig,
        UpdateConfig updateConfig,
        string language,
        CancellationToken cancellationToken = default)
    {
        var path = ConfigPath;
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        JObject root;
        if (File.Exists(path))
        {
            var existing = await File.ReadAllTextAsync(path, cancellationToken);
            root = string.IsNullOrWhiteSpace(existing) ? new JObject() : JObject.Parse(existing);
        }
        else
        {
            root = new JObject();
        }

        var everything = (JObject?)root["Everything"] ?? new JObject();
        everything["BaseUrl"] = everythingConfig.BaseUrl ?? string.Empty;
        everything["UserName"] = string.IsNullOrWhiteSpace(everythingConfig.UserName) ? null : everythingConfig.UserName;
        everything["Password"] = string.IsNullOrWhiteSpace(everythingConfig.Password) ? null : everythingConfig.Password;
        root["Everything"] = everything;

        var qb = (JObject?)root["QBittorrent"] ?? new JObject();
        qb["BaseUrl"] = qBittorrentConfig.BaseUrl ?? string.Empty;
        qb["UserName"] = string.IsNullOrWhiteSpace(qBittorrentConfig.UserName) ? null : qBittorrentConfig.UserName;
        qb["Password"] = string.IsNullOrWhiteSpace(qBittorrentConfig.Password) ? null : qBittorrentConfig.Password;
        root["QBittorrent"] = qb;

        var javDb = (JObject?)root["JavDb"] ?? new JObject();
        javDb["BaseUrl"] = javDbConfig.BaseUrl ?? string.Empty;
        javDb["MirrorUrls"] = new JArray((javDbConfig.MirrorUrls ?? new List<string>())
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim()));
        root["JavDb"] = javDb;

        var download = (JObject?)root["Download"] ?? new JObject();
        download["DefaultSavePath"] = downloadConfig.DefaultSavePath ?? string.Empty;
        download["DefaultCategory"] = downloadConfig.DefaultCategory ?? string.Empty;
        download["DefaultTags"] = downloadConfig.DefaultTags ?? string.Empty;
        root["Download"] = download;

        var console = (JObject?)root["Console"] ?? new JObject();
        console["Language"] = string.IsNullOrWhiteSpace(language) ? "en" : language;
        root["Console"] = console;

        var update = (JObject?)root["Update"] ?? new JObject();
        update["Enabled"] = updateConfig.Enabled;
        update["AutoCheckOnStartup"] = updateConfig.AutoCheckOnStartup;
        update["GitHubRepo"] = string.IsNullOrWhiteSpace(updateConfig.GitHubRepo) ? "jqknono/jav-manager" : updateConfig.GitHubRepo.Trim();
        root["Update"] = update;

        var output = root.ToString(Formatting.Indented);
        await File.WriteAllTextAsync(path, output, cancellationToken);
    }
}

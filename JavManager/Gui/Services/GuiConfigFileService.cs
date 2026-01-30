using JavManager.Core.Configuration.ConfigSections;
using JavManager.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace JavManager.Gui.Services;

public sealed class GuiConfigFileService
{
    public string ConfigPath => AppPaths.GetAppSettingsPath();

    public async Task SaveAsync(
        EverythingConfig everythingConfig,
        QBittorrentConfig qBittorrentConfig,
        JavDbConfig javDbConfig,
        DownloadConfig downloadConfig,
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
        root["JavDb"] = javDb;

        var download = (JObject?)root["Download"] ?? new JObject();
        download["DefaultSavePath"] = downloadConfig.DefaultSavePath ?? string.Empty;
        download["DefaultCategory"] = downloadConfig.DefaultCategory ?? string.Empty;
        download["DefaultTags"] = downloadConfig.DefaultTags ?? string.Empty;
        root["Download"] = download;

        var console = (JObject?)root["Console"] ?? new JObject();
        console["Language"] = string.IsNullOrWhiteSpace(language) ? "en" : language;
        root["Console"] = console;

        var output = root.ToString(Formatting.Indented);
        await File.WriteAllTextAsync(path, output, cancellationToken);
    }
}

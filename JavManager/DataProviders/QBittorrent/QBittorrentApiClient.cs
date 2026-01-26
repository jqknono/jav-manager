using System.Text;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Localization;
using JavManager.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Net;

namespace JavManager.DataProviders.QBittorrent;

/// <summary>
/// qBittorrent WebUI API 客户端
/// </summary>
public class QBittorrentApiClient : IQBittorrentClient, IHealthChecker
{
    private readonly QBittorrentConfig _config;
    private readonly HttpHelper _httpHelper;
    private readonly LocalizationService _loc;
    private readonly string _baseUrl;
    private string? _sidCookie;
    private DateTime _loginTime;

    public QBittorrentApiClient(QBittorrentConfig config, LocalizationService localizationService, HttpHelper? httpHelper = null)
    {
        _config = config;
        _loc = localizationService;
        _httpHelper = httpHelper ?? new HttpHelper(TimeSpan.FromSeconds(30));
        _baseUrl = _config.BaseUrl.TrimEnd('/');

        // 设置默认请求头
        _httpHelper.SetDefaultHeader("Referer", _baseUrl);
    }

    /// <summary>
    /// 登录认证
    /// </summary>
    public async Task LoginAsync()
    {
        try
        {
            var formData = new Dictionary<string, string>
            {
                { "username", _config.UserName },
                { "password", _config.Password }
            };

            var url = $"{_baseUrl}/api/v2/auth/login";
            var response = await _httpHelper.PostAsync(url, formData);

            if (!IsOkResponse(response))
                throw new InvalidOperationException($"qBittorrent login rejected: {NormalizeResponseText(response)}");

            _sidCookie = "1";

            _loginTime = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"qBittorrent login failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 确保已登录（处理认证过期）
    /// </summary>
    private async Task EnsureLoggedInAsync()
    {
        // 如果未登录或超过 30 分钟，重新登录
        if (_sidCookie == null || DateTime.UtcNow - _loginTime > TimeSpan.FromMinutes(30))
        {
            await LoginAsync();
        }
    }

    /// <summary>
    /// 添加种子（磁力链接）
    /// </summary>
    public async Task<bool> AddTorrentAsync(string magnetLink, string? savePath = null, string? category = null, string? tags = null)
    {
        await EnsureLoggedInAsync();

        try
        {
            magnetLink = NormalizeMagnetLink(magnetLink);
            var infoHash = TryExtractInfoHash(magnetLink);
            var formData = new Dictionary<string, string>
            {
                { "urls", magnetLink }
            };

            if (!string.IsNullOrEmpty(savePath))
                formData["savepath"] = savePath;

            if (!string.IsNullOrEmpty(category))
                formData["category"] = category;

            if (!string.IsNullOrEmpty(tags))
                formData["tags"] = tags;

            var url = $"{_baseUrl}/api/v2/torrents/add";
            var response = await _httpHelper.PostMultipartAsync(url, formData);
            if (!IsOkResponse(response))
                throw new InvalidOperationException($"qBittorrent rejected torrent: {NormalizeResponseText(response)}");

            if (infoHash != null && !await TorrentExistsAsync(infoHash))
                throw new InvalidOperationException("qBittorrent did not add the torrent (not found in torrent list after add).");

            return true;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to add torrent: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 添加种子（URL）
    /// </summary>
    public async Task<bool> AddTorrentFromUrlAsync(List<string> urls, string? savePath = null, string? category = null, string? tags = null)
    {
        await EnsureLoggedInAsync();

        try
        {
            var urlList = string.Join("\n", urls);
            var formData = new Dictionary<string, string>
            {
                { "urls", urlList }
            };

            if (!string.IsNullOrEmpty(savePath))
                formData["savepath"] = savePath;

            if (!string.IsNullOrEmpty(category))
                formData["category"] = category;

            if (!string.IsNullOrEmpty(tags))
                formData["tags"] = tags;

            var url = $"{_baseUrl}/api/v2/torrents/add";
            var response = await _httpHelper.PostMultipartAsync(url, formData);
            if (!IsOkResponse(response))
                throw new InvalidOperationException($"qBittorrent rejected torrent URL(s): {NormalizeResponseText(response)}");

            return true;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to add torrent from URL: {ex.Message}", ex);
        }
    }

    private static string NormalizeMagnetLink(string magnetLink)
    {
        if (string.IsNullOrWhiteSpace(magnetLink))
            return string.Empty;

        return WebUtility.HtmlDecode(magnetLink).Trim();
    }

    private static bool IsOkResponse(string responseBody)
    {
        var text = NormalizeResponseText(responseBody);
        if (string.IsNullOrEmpty(text))
            return true;

        return text.Equals("ok.", StringComparison.OrdinalIgnoreCase)
               || text.Equals("ok", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeResponseText(string responseBody)
        => (responseBody ?? string.Empty).Trim();

    private async Task<bool> TorrentExistsAsync(string infoHash)
    {
        try
        {
            var url = $"{_baseUrl}/api/v2/torrents/info?hashes={Uri.EscapeDataString(infoHash)}";
            var response = await _httpHelper.GetAsync(url);
            var jsonArray = JArray.Parse(response);
            return jsonArray.Count > 0;
        }
        catch
        {
            // If verification fails, do not mask a successful add.
            return true;
        }
    }

    private static string? TryExtractInfoHash(string magnetLink)
    {
        if (string.IsNullOrWhiteSpace(magnetLink))
            return null;

        // magnet:?xt=urn:btih:<hash>
        var match = System.Text.RegularExpressions.Regex.Match(
            magnetLink,
            @"(?i)\bxt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})\b");

        if (!match.Success)
            return null;

        return match.Groups[1].Value.ToLowerInvariant();
    }

    /// <summary>
    /// 获取种子列表
    /// </summary>
    public async Task<List<TorrentInfo>> GetTorrentsAsync()
    {
        await EnsureLoggedInAsync();

        try
        {
            var url = $"{_baseUrl}/api/v2/torrents/info";
            var response = await _httpHelper.GetAsync(url);

            return ParseTorrentList(response);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to get torrent list: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 暂停种子
    /// </summary>
    public async Task PauseAsync(List<string> hashes)
    {
        await EnsureLoggedInAsync();

        try
        {
            var hashesStr = string.Join("|", hashes);
            var url = $"{_baseUrl}/api/v2/torrents/stop?hashes={Uri.EscapeDataString(hashesStr)}";
            await _httpHelper.PostAsync(url, new Dictionary<string, string>());
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to pause torrents: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 恢复种子
    /// </summary>
    public async Task ResumeAsync(List<string> hashes)
    {
        await EnsureLoggedInAsync();

        try
        {
            var hashesStr = string.Join("|", hashes);
            var url = $"{_baseUrl}/api/v2/torrents/start?hashes={Uri.EscapeDataString(hashesStr)}";
            await _httpHelper.PostAsync(url, new Dictionary<string, string>());
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to resume torrents: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 删除种子
    /// </summary>
    public async Task DeleteAsync(List<string> hashes, bool deleteFiles = false)
    {
        await EnsureLoggedInAsync();

        try
        {
            var hashesStr = string.Join("|", hashes);
            var url = $"{_baseUrl}/api/v2/torrents/delete?hashes={Uri.EscapeDataString(hashesStr)}&deleteFiles={deleteFiles.ToString().ToLower()}";
            await _httpHelper.PostAsync(url, new Dictionary<string, string>());
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to delete torrents: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 解析种子列表响应
    /// </summary>
    private List<TorrentInfo> ParseTorrentList(string jsonResponse)
    {
        var results = new List<TorrentInfo>();

        try
        {
            var jsonArray = JArray.Parse(jsonResponse);

            foreach (var item in jsonArray)
            {
                results.Add(new TorrentInfo
                {
                    Title = item["name"]?.ToString() ?? string.Empty,
                    Size = item["size"]?.ToObject<long>() ?? 0,
                    Seeders = item["num_seeds"]?.ToObject<int>() ?? 0,
                    Leechers = item["num_leechs"]?.ToObject<int>() ?? 0,
                    MagnetLink = item["magnet_uri"]?.ToString() ?? string.Empty,
                    Progress = item["progress"]?.ToObject<double?>(),
                    State = item["state"]?.ToString(),
                    SourceSite = "qBittorrent"
                });
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to parse torrent list: {ex.Message}", ex);
        }

        return results;
    }

    public void Dispose()
    {
        _httpHelper?.Dispose();
    }

    // ========== IHealthChecker 实现 ==========

    /// <summary>
    /// 服务名称
    /// </summary>
    string IHealthChecker.ServiceName => _loc.Get(L.ServiceNameQBittorrent);

    /// <summary>
    /// 检查服务健康状态
    /// </summary>
    public async Task<HealthCheckResult> CheckHealthAsync()
    {
        var healthCheckTimeout = TimeSpan.FromSeconds(3);

        // 健康检查重试（主要应对网络/DNS 等瞬时问题）
        const int maxAttempts = 3;
        Exception? lastException = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                // 尝试登录来验证连接
                var formData = new Dictionary<string, string>
                {
                    { "username", _config.UserName },
                    { "password", _config.Password }
                };

                var url = $"{_baseUrl}/api/v2/auth/login";
                var response = await _httpHelper.PostAsync(url, formData, timeout: healthCheckTimeout);
                if (!IsOkResponse(response))
                {
                    return new HealthCheckResult
                    {
                        ServiceName = ((IHealthChecker)this).ServiceName,
                        IsHealthy = false,
                        Message = _loc.GetFormat(L.HealthConnectionFailed, $"Login rejected: {NormalizeResponseText(response)}"),
                        Url = _baseUrl
                    };
                }

                return new HealthCheckResult
                {
                    ServiceName = ((IHealthChecker)this).ServiceName,
                    IsHealthy = true,
                    Message = _loc.Get(L.HealthServiceOk),
                    Url = _baseUrl
                };
            }
            catch (Exception ex)
            {
                lastException = ex;
            }
        }

        return new HealthCheckResult
        {
            ServiceName = ((IHealthChecker)this).ServiceName,
            IsHealthy = false,
            Message = _loc.GetFormat(L.HealthConnectionFailed, lastException?.Message ?? "Unknown error"),
            Url = _baseUrl
        };
    }
}

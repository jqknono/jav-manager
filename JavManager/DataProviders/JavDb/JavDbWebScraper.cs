using HtmlAgilityPack;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Localization;
using JavManager.Utils;
using Spectre.Console;
using System.Net;
using System.Net.Http;
using System.Security.Authentication;

namespace JavManager.DataProviders.JavDb;

/// <summary>
/// JavDB HTTP 爬虫（内部伪装为 Chrome，反复尝试）
/// 使用 HTTP/1.1 降级 + 完整 Chrome headers 以提高绕过 Cloudflare 成功率
/// </summary>
public class JavDbWebScraper : IJavDbDataProvider, IHealthChecker
{
    private readonly JavDbConfig _config;
    private readonly TorrentNameParser _nameParser;
    private readonly LocalizationService _loc;
    private readonly JavDbHtmlParser _htmlParser;
    private readonly HttpClient _httpClient;
    private readonly CookieContainer _cookieContainer;
    private readonly List<string> _userAgents;
    private readonly Random _random = new();
    private const int MaxAttemptsPerUrl = 4;
    private const int MaxUrlCycles = 2;
    private static readonly TimeSpan RetryBaseDelay = TimeSpan.FromMilliseconds(1000);
    private const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    public JavDbWebScraper(JavDbConfig config, TorrentNameParser nameParser, LocalizationService localizationService)
    {
        _config = config;
        _nameParser = nameParser;
        _loc = localizationService;
        _htmlParser = new JavDbHtmlParser();

        _cookieContainer = new CookieContainer();
        _httpClient = CreateHttpClient(_cookieContainer, _config.RequestTimeout);
        _userAgents = BuildUserAgentCandidates(_config.UserAgent);
    }

    /// <summary>
    /// 搜索番号并获取种子列表
    /// </summary>
    public async Task<JavSearchResult> SearchAsync(string javId)
    {
        var candidates = await SearchCandidatesAsync(javId);
        if (candidates.Count == 0)
            return new JavSearchResult { JavId = javId };

        var selected = ChooseBestCandidate(candidates, javId);
        AnsiConsole.MarkupLine($"[grey][[DEBUG]] Selected: JavId={Markup.Escape(selected.JavId)}, DetailUrl={Markup.Escape(selected.DetailUrl)}[/]");

        var result = await GetDetailAsync(selected.DetailUrl);
        if (string.IsNullOrWhiteSpace(result.JavId))
            result.JavId = javId;

        return result;
    }

    public async Task<List<JavSearchResult>> SearchCandidatesAsync(string javId)
    {
        var urls = new List<string> { _config.BaseUrl };
        urls.AddRange(_config.MirrorUrls);
        urls = urls
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var lastError = "";
        for (var cycle = 0; cycle < MaxUrlCycles; cycle++)
        {
            foreach (var baseUrl in urls)
            {
                try
                {
                    var baseUrlTrimmed = baseUrl.TrimEnd('/');
                    SeedCookiesForUrl(baseUrlTrimmed);

                    // 第一步：访问首页建立会话
                    var homeResponse = await GetWithRetryAsync(baseUrlTrimmed, referer: null, maxAttempts: MaxAttemptsPerUrl);
                    if (!IsSuccessStatusCode(homeResponse.StatusCode))
                    {
                        lastError = !string.IsNullOrWhiteSpace(homeResponse.Error)
                            ? $"{baseUrlTrimmed}: {homeResponse.Error}"
                            : _loc.GetFormat(L.JavDbHomeRequestFailed, homeResponse.StatusCode);
                        if (IsRetryableStatus(homeResponse.StatusCode))
                            continue;
                        continue;
                    }

                    // 第二步：访问搜索页面
                    var searchUrl = $"{baseUrlTrimmed}/search?q={Uri.EscapeDataString(javId)}&f=all";
                    var searchResponse = await GetWithRetryAsync(searchUrl, baseUrlTrimmed, maxAttempts: MaxAttemptsPerUrl);
                    if (!IsSuccessStatusCode(searchResponse.StatusCode))
                    {
                        lastError = !string.IsNullOrWhiteSpace(searchResponse.Error)
                            ? $"{baseUrlTrimmed}: {searchResponse.Error}"
                            : _loc.GetFormat(L.JavDbSearchRequestFailed, searchResponse.StatusCode);
                        if (IsRetryableStatus(searchResponse.StatusCode))
                            continue;
                        continue;
                    }

                    var html = searchResponse.Body;
                    AnsiConsole.MarkupLine($"[grey][[DEBUG]] Search page HTML length: {html.Length}[/]");

                    // Parse search results
                    var searchResults = _htmlParser.ParseSearchResults(html);
                    AnsiConsole.MarkupLine($"[grey][[DEBUG]] Parsed search results count: {searchResults.Count}[/]");

                    if (searchResults.Count == 0)
                        return new List<JavSearchResult>();

                    // 统一详情链接为绝对 URL（保持镜像域名一致）
                    foreach (var r in searchResults)
                    {
                        if (!string.IsNullOrWhiteSpace(r.DetailUrl) &&
                            !r.DetailUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                            !r.DetailUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                        {
                            r.DetailUrl = $"{baseUrlTrimmed}{r.DetailUrl}";
                        }
                    }

                    // 去重
                    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    var deduped = new List<JavSearchResult>();
                    foreach (var r in searchResults)
                    {
                        var key = string.IsNullOrWhiteSpace(r.DetailUrl) ? $"{r.Title}|{r.JavId}" : r.DetailUrl;
                        if (seen.Add(key))
                            deduped.Add(r);
                    }

                    if (deduped.Count > 0)
                    {
                        var first = deduped.First();
                        AnsiConsole.MarkupLine($"[grey][[DEBUG]] First result: JavId={Markup.Escape(first.JavId)}, DetailUrl={Markup.Escape(first.DetailUrl)}[/]");
                    }

                    return deduped;
                }
                catch (Exception ex)
                {
                    lastError = $"{baseUrl}: {ex.Message}";
                    AnsiConsole.MarkupLine($"[grey][[DEBUG]] Exception: {Markup.Escape(lastError)}[/]");
                    continue;
                }
            }
        }

        throw new InvalidOperationException(_loc.GetFormat(L.JavDbHttpRequestFailed, lastError));
    }

    /// <summary>
    /// 获取视频详情
    /// </summary>
    public async Task<JavSearchResult> GetDetailAsync(string detailUrl)
    {
        var baseUrl = _config.BaseUrl.TrimEnd('/');

        // 允许传入相对路径
        if (!detailUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !detailUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            detailUrl = $"{baseUrl}{detailUrl}";
        }

        var referer = baseUrl;
        if (Uri.TryCreate(detailUrl, UriKind.Absolute, out var uri))
        {
            referer = uri.GetLeftPart(UriPartial.Authority);
        }

        SeedCookiesForUrl(referer);
        var response = await GetWithRetryAsync(detailUrl, referer, maxAttempts: MaxAttemptsPerUrl);
        if (!IsSuccessStatusCode(response.StatusCode))
        {
            var error = !string.IsNullOrWhiteSpace(response.Error)
                ? response.Error
                : $"Detail: HTTP {response.StatusCode}";
            throw new InvalidOperationException(_loc.GetFormat(L.JavDbHttpRequestFailed, error));
        }
        var html = response.Body;

        var result = _htmlParser.ParseDetailPage(html);
        result.DetailUrl = detailUrl;

        // 解析种子链接
        var torrents = ParseTorrentLinks(html);
        result.Torrents = torrents;

        return result;
    }

    private static HttpClient CreateHttpClient(CookieContainer cookieContainer, int timeoutMs)
    {
        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 10,
            UseCookies = true,
            CookieContainer = cookieContainer,
            ConnectTimeout = TimeSpan.FromSeconds(15),
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            // 使用 HTTP/1.1：Cloudflare 对 HTTP/1.1 的指纹检测较宽松
            // HTTP/2 的 SETTINGS 帧顺序等特征容易被检测
            EnableMultipleHttp2Connections = false,
            SslOptions = new System.Net.Security.SslClientAuthenticationOptions
            {
                EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13
            }
        };

        var client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromMilliseconds(timeoutMs)
        };
        // 强制 HTTP/1.1 以避免 HTTP/2 指纹检测
        client.DefaultRequestVersion = HttpVersion.Version11;
        client.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact;
        return client;
    }

    private static List<string> BuildUserAgentCandidates(string? configuredUserAgent)
    {
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(configuredUserAgent))
            candidates.Add(configuredUserAgent.Trim());

        candidates.Add(DefaultUserAgent);
        candidates.Add("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        candidates.Add("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

        return candidates
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private void SeedCookiesForUrl(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
            return;

        _cookieContainer.Add(uri, new Cookie("over18", "1", "/"));
        _cookieContainer.Add(uri, new Cookie("locale", "zh", "/"));

        if (!string.IsNullOrWhiteSpace(_config.CfClearance))
            _cookieContainer.Add(uri, new Cookie("cf_clearance", _config.CfClearance, "/"));

        if (!string.IsNullOrWhiteSpace(_config.CfBm))
            _cookieContainer.Add(uri, new Cookie("__cf_bm", _config.CfBm, "/"));
    }

    private async Task<(int StatusCode, string Body, bool IsCloudflare, string? Error)> GetWithRetryAsync(
        string url,
        string? referer,
        int maxAttempts,
        int? timeoutMs = null)
    {
        var effectiveTimeout = timeoutMs ?? _config.RequestTimeout;
        var lastError = "";

        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            // 添加随机延迟模拟人类行为（首次请求也加小延迟）
            if (attempt > 0)
            {
                var delay = GetRetryDelay(attempt);
                AnsiConsole.MarkupLine($"[grey][[DEBUG]] Waiting {delay.TotalMilliseconds:F0}ms before retry...[/]");
                await Task.Delay(delay);
            }
            else
            {
                // 首次请求加小随机延迟
                await Task.Delay(_random.Next(100, 500));
            }

            var result = await SendRequestAsync(url, referer, attempt, effectiveTimeout);
            if (IsSuccessStatusCode(result.StatusCode))
                return result;

            lastError = !string.IsNullOrWhiteSpace(result.Error)
                ? result.Error
                : $"HTTP {result.StatusCode}";

            AnsiConsole.MarkupLine(
                $"[grey][[DEBUG]] Request failed (attempt {attempt + 1}/{maxAttempts}): {Markup.Escape(url)} status={result.StatusCode}, cf={result.IsCloudflare}, error={Markup.Escape(lastError)}[/]");

            if (!IsRetryableStatus(result.StatusCode) || attempt == maxAttempts - 1)
                return (result.StatusCode, result.Body, result.IsCloudflare, lastError);
        }

        return (0, string.Empty, false, lastError);
    }

    private async Task<(int StatusCode, string Body, bool IsCloudflare, string? Error)> SendRequestAsync(
        string url,
        string? referer,
        int attemptIndex,
        int timeoutMs)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        ApplyChromeHeaders(request, referer, attemptIndex);

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs));
        try
        {
            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            var body = await response.Content.ReadAsStringAsync(cts.Token);
            var isCloudflare = response.Headers.Contains("cf-mitigated") ||
                               response.Headers.Contains("cf-ray");
            return ((int)response.StatusCode, body, isCloudflare, null);
        }
        catch (TaskCanceledException)
        {
            return (0, string.Empty, false, $"Timeout after {timeoutMs}ms");
        }
        catch (HttpRequestException ex)
        {
            return (0, string.Empty, false, ex.Message);
        }
    }

    private void ApplyChromeHeaders(HttpRequestMessage request, string? referer, int attemptIndex)
    {
        var userAgent = _userAgents[attemptIndex % _userAgents.Count];
        var chromeMajor = ParseChromeMajorVersion(userAgent);
        var platform = GetPlatformFromUserAgent(userAgent);
        var mobile = userAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase) ? "?1" : "?0";

        // Chrome 真实请求的 header 顺序（顺序对某些 WAF 检测很重要）
        // 1. Host (由 HttpClient 自动添加)
        // 2. Connection
        request.Headers.TryAddWithoutValidation("Connection", "keep-alive");

        // 3. Cache-Control
        request.Headers.TryAddWithoutValidation("Cache-Control", "max-age=0");

        // 4. sec-ch-ua 系列
        request.Headers.TryAddWithoutValidation("sec-ch-ua", BuildSecChUa(chromeMajor));
        request.Headers.TryAddWithoutValidation("sec-ch-ua-mobile", mobile);
        request.Headers.TryAddWithoutValidation("sec-ch-ua-platform", $"\"{platform}\"");

        // 5. DNT
        request.Headers.TryAddWithoutValidation("DNT", "1");

        // 6. Upgrade-Insecure-Requests
        request.Headers.TryAddWithoutValidation("Upgrade-Insecure-Requests", "1");

        // 7. User-Agent
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);

        // 8. Accept
        request.Headers.TryAddWithoutValidation("Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");

        // 9. Sec-Fetch 系列
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Site", string.IsNullOrWhiteSpace(referer) ? "none" : "same-origin");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "navigate");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-User", "?1");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "document");

        // 10. Referer
        if (!string.IsNullOrWhiteSpace(referer) && Uri.TryCreate(referer, UriKind.Absolute, out var refererUri))
        {
            request.Headers.Referrer = refererUri;
        }

        // 11. Accept-Encoding
        request.Headers.TryAddWithoutValidation("Accept-Encoding", "gzip, deflate, br");

        // 12. Accept-Language
        request.Headers.TryAddWithoutValidation("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7");
    }

    private static string BuildSecChUa(string chromeMajor)
        => $"\"Google Chrome\";v=\"{chromeMajor}\", \"Chromium\";v=\"{chromeMajor}\", \"Not_A Brand\";v=\"24\"";

    private static string ParseChromeMajorVersion(string userAgent)
    {
        var match = System.Text.RegularExpressions.Regex.Match(userAgent, @"Chrome/(\d+)");
        return match.Success ? match.Groups[1].Value : "131";
    }

    private static string GetPlatformFromUserAgent(string userAgent)
    {
        if (userAgent.Contains("Windows", StringComparison.OrdinalIgnoreCase))
            return "Windows";
        if (userAgent.Contains("Mac OS X", StringComparison.OrdinalIgnoreCase) || userAgent.Contains("Macintosh", StringComparison.OrdinalIgnoreCase))
            return "macOS";
        if (userAgent.Contains("Linux", StringComparison.OrdinalIgnoreCase))
            return "Linux";
        if (userAgent.Contains("Android", StringComparison.OrdinalIgnoreCase))
            return "Android";
        return "Windows";
    }

    private TimeSpan GetRetryDelay(int attemptIndex)
    {
        // 指数退避 + 随机抖动，模拟人类行为
        var baseMs = RetryBaseDelay.TotalMilliseconds * Math.Pow(1.5, attemptIndex);
        var jitter = _random.Next(-300, 500);
        return TimeSpan.FromMilliseconds(Math.Max(500, baseMs + jitter));
    }

    private static bool IsSuccessStatusCode(int statusCode)
        => statusCode >= 200 && statusCode < 300;

    private static bool IsRetryableStatus(int statusCode)
        => statusCode == 0 ||
           statusCode == 403 ||
           statusCode == 408 ||
           statusCode == 425 ||
           statusCode == 429 ||
           statusCode == 500 ||
           statusCode == 502 ||
           statusCode == 503 ||
           statusCode == 520 ||
           statusCode == 522 ||
           statusCode == 524;

    /// <summary>
    /// 解析种子链接（从 HTML 中提取磁力链接）
    /// </summary>
    private List<TorrentInfo> ParseTorrentLinks(string html)
    {
        var torrents = new List<TorrentInfo>();
        var seenMagnets = new HashSet<string>(); // 避免重复

        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        // JavDB 的磁力链接在 div.magnet-name 中的 <a href="magnet:...">
        // 标题在 <span class="name"> 内
        var magnetItems = doc.DocumentNode.SelectNodes("//div[contains(@class, 'magnet-name')]");

        if (magnetItems != null)
        {
            foreach (var item in magnetItems)
            {
                var magnetNode = item.SelectSingleNode(".//a[starts-with(@href, 'magnet:')]");
                if (magnetNode == null)
                    continue;

                var magnetLink = magnetNode.GetAttributeValue("href", "");
                magnetLink = WebUtility.HtmlDecode(magnetLink);
                if (string.IsNullOrEmpty(magnetLink) || !magnetLink.StartsWith("magnet:"))
                    continue;

                // 避免重复
                var hash = ExtractMagnetHash(magnetLink);
                if (!string.IsNullOrEmpty(hash) && seenMagnets.Contains(hash))
                    continue;
                if (!string.IsNullOrEmpty(hash))
                    seenMagnets.Add(hash);

                // 从 <span class="name"> 获取标题
                var nameNode = item.SelectSingleNode(".//span[@class='name']");
                var title = NormalizeInlineText(nameNode?.InnerText);

                // meta 区域可能包含大小信息
                var metaNode = item.SelectSingleNode(".//span[contains(@class, 'meta')]");
                var meta = NormalizeInlineText(metaNode?.InnerText);

                var size = 0L;
                if (!TryExtractSizeFromMagnet(magnetLink, out size))
                {
                    TryParseSizeBytes(meta, out size);
                }

                var hasSubtitle = false;
                var hasUncensored = false;
                var hasHd = false;
                
                // 检查是否有标签
                var tagNodes = item.SelectNodes(".//span[contains(@class, 'tag')]");
                if (tagNodes != null)
                {
                    foreach (var tag in tagNodes)
                    {
                        var tagText = NormalizeInlineText(tag.InnerText);
                        if (string.IsNullOrEmpty(tagText))
                            continue;

                        // 字幕
                        if (tagText.Contains("字幕", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("中文", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("中文字幕", StringComparison.OrdinalIgnoreCase))
                        {
                            hasSubtitle = true;
                        }

                        // 无码
                        if (tagText.Contains("無碼", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("无码", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("破解", StringComparison.OrdinalIgnoreCase))
                        {
                            hasUncensored = true;
                        }

                        // 高清
                        if (tagText.Contains("高清", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("HD", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("1080", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("720", StringComparison.OrdinalIgnoreCase) ||
                            tagText.Contains("4K", StringComparison.OrdinalIgnoreCase))
                        {
                            hasHd = true;
                        }
                    }
                }

                // 字幕以 JavDB 返回信息为准（不从标题推断）
                if (!hasHd &&
                    (title.Contains("HD", StringComparison.OrdinalIgnoreCase) ||
                     title.Contains("1080", StringComparison.OrdinalIgnoreCase) ||
                     title.Contains("720", StringComparison.OrdinalIgnoreCase) ||
                     title.Contains("4K", StringComparison.OrdinalIgnoreCase)))
                {
                    hasHd = true;
                }

                var (titleUncensoredType, _) = _nameParser.Parse(title);
                hasUncensored = hasUncensored || titleUncensoredType != UncensoredMarkerType.None;
                var uncensoredMarkerType = hasUncensored
                    ? hasSubtitle ? UncensoredMarkerType.UC : UncensoredMarkerType.U
                    : UncensoredMarkerType.None;

                var torrentInfo = new TorrentInfo
                {
                    Title = title,
                    MagnetLink = magnetLink,
                    Size = size,
                    HasSubtitle = hasSubtitle,
                    HasUncensoredMarker = hasUncensored,
                    UncensoredMarkerType = uncensoredMarkerType,
                    HasHd = hasHd,
                    SourceSite = "JavDB"
                };
                torrents.Add(torrentInfo);
            }
        }

        return torrents;
    }

    private static string NormalizeInlineText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        // 将多行/多空白压缩为单空格，避免控制台表格出现“多行标题”
        var normalized = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ");
        return normalized.Trim();
    }

    private static bool TryExtractSizeFromMagnet(string magnetLink, out long bytes)
    {
        bytes = 0;
        if (string.IsNullOrWhiteSpace(magnetLink))
            return false;

        // magnet:?xt=...&dn=...&xl=123456789
        var match = System.Text.RegularExpressions.Regex.Match(magnetLink, @"(?:[?&]xl=)(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success)
            return false;

        return long.TryParse(match.Groups[1].Value, out bytes) && bytes > 0;
    }

    private static bool TryParseSizeBytes(string text, out long bytes)
    {
        bytes = 0;
        if (string.IsNullOrWhiteSpace(text))
            return false;

        // 兼容：1.23GB / 1.23 GiB / 1234MB 等
        var match = System.Text.RegularExpressions.Regex.Match(
            text,
            @"(?i)(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)\b");

        if (!match.Success)
            return false;

        var numberText = match.Groups[1].Value;
        var unit = match.Groups[2].Value;

        if (!double.TryParse(
                numberText,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var value))
        {
            return false;
        }

        var multiplier = unit.ToUpperInvariant() switch
        {
            "B" => 1d,
            "KB" or "KIB" => 1024d,
            "MB" or "MIB" => 1024d * 1024d,
            "GB" or "GIB" => 1024d * 1024d * 1024d,
            "TB" or "TIB" => 1024d * 1024d * 1024d * 1024d,
            _ => 0d
        };

        if (multiplier <= 0)
            return false;

        bytes = (long)(value * multiplier);
        return bytes > 0;
    }

    /// <summary>
    /// 从磁力链接中提取 hash
    /// </summary>
    private static string ExtractMagnetHash(string magnetLink)
    {
        var match = System.Text.RegularExpressions.Regex.Match(magnetLink, @"btih:([a-fA-F0-9]+)");
        return match.Success ? match.Groups[1].Value.ToLowerInvariant() : "";
    }

    private JavSearchResult ChooseBestCandidate(List<JavSearchResult> candidates, string query)
    {
        if (candidates.Count == 1)
            return candidates[0];

        var normalizedQuery = _nameParser.NormalizeJavId(query);

        foreach (var c in candidates)
        {
            var id = _nameParser.NormalizeJavId(string.IsNullOrWhiteSpace(c.JavId) ? c.Title : c.JavId);
            if (IsValidJavId(id) && id.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase))
                return c;

            var idFromTitle = _nameParser.NormalizeJavId(c.Title);
            if (IsValidJavId(idFromTitle) && idFromTitle.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase))
                return c;
        }

        var match = candidates.FirstOrDefault(c =>
            !string.IsNullOrWhiteSpace(c.Title) &&
            c.Title.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase));
        return match ?? candidates[0];
    }

    private static bool IsValidJavId(string javId)
        => System.Text.RegularExpressions.Regex.IsMatch(
            javId,
            @"^[A-Z0-9]+-\d+$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    public void Dispose()
    {
        _httpClient?.Dispose();
    }

    // ========== IHealthChecker 实现 ==========

    /// <summary>
    /// 服务名称
    /// </summary>
    string IHealthChecker.ServiceName => _loc.Get(L.ServiceNameJavDb);

    /// <summary>
    /// 检查服务健康状态
    /// 依次尝试主站和所有镜像站，任一成功即认为健康
    /// </summary>
    public async Task<HealthCheckResult> CheckHealthAsync()
    {
        const int healthCheckTimeoutSeconds = 3;

        // 构建所有待检查的 URL（主站 + 镜像站）
        var urls = new List<string> { _config.BaseUrl };
        urls.AddRange(_config.MirrorUrls);
        urls = urls
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (urls.Count == 0)
        {
            return new HealthCheckResult
            {
                ServiceName = ((IHealthChecker)this).ServiceName,
                IsHealthy = false,
                Message = _loc.Get(L.HealthAllUrlsFailed),
                Url = _config.BaseUrl
            };
        }

        var failedUrls = new List<string>();
        string? lastError = null;

        // 依次尝试每个 URL，任一成功即返回健康
        foreach (var url in urls)
        {
            try
            {
                var testUrl = url.TrimEnd('/');
                SeedCookiesForUrl(testUrl);
                var response = await GetWithRetryAsync(
                    testUrl,
                    referer: null,
                    maxAttempts: 2,
                    timeoutMs: healthCheckTimeoutSeconds * 1000);

                if (IsSuccessStatusCode(response.StatusCode))
                {
                    return new HealthCheckResult
                    {
                        ServiceName = ((IHealthChecker)this).ServiceName,
                        IsHealthy = true,
                        Message = _loc.Get(L.HealthServiceOk),
                        Url = url
                    };
                }

                // HTTP 错误（如 403）
                failedUrls.Add(url);
                lastError = !string.IsNullOrWhiteSpace(response.Error)
                    ? $"{url}: {response.Error}"
                    : $"{url}: HTTP {(int)response.StatusCode}";
            }
            catch (Exception ex)
            {
                failedUrls.Add(url);
                lastError = $"{url}: {ex.Message}";
            }
        }

        // 所有 URL 都失败
        return new HealthCheckResult
        {
            ServiceName = ((IHealthChecker)this).ServiceName,
            IsHealthy = false,
            Message = _loc.GetFormat(L.HealthConnectionFailed, lastError ?? _loc.Get(L.HealthAllUrlsFailed)),
            Url = _config.BaseUrl
        };
    }
}

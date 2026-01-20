using HtmlAgilityPack;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Utils;
using System.Net;

namespace JavManager.DataProviders.JavDb;

/// <summary>
/// JavDB HTTP 爬虫（使用 curl 绕过 TLS 指纹检测）
/// </summary>
public class JavDbWebScraper : IJavDbDataProvider, IHealthChecker
{
    private readonly JavDbConfig _config;
    private readonly TorrentNameParser _nameParser;
    private readonly CurlHttpClient _curlClient;
    private readonly JavDbHtmlParser _htmlParser;

    public JavDbWebScraper(JavDbConfig config, TorrentNameParser nameParser)
    {
        _config = config;
        _nameParser = nameParser;
        _htmlParser = new JavDbHtmlParser();

        // 使用 curl 客户端绕过 TLS 指纹检测
        _curlClient = new CurlHttpClient(_config.RequestTimeout / 1000);

        // 设置请求头模拟真实浏览器
        _curlClient.SetDefaultHeader("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        _curlClient.SetDefaultHeader("Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
        _curlClient.SetDefaultHeader("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
        _curlClient.SetDefaultHeader("Upgrade-Insecure-Requests", "1");
        _curlClient.SetDefaultHeader("Sec-Fetch-Site", "same-origin");
        _curlClient.SetDefaultHeader("Sec-Fetch-Mode", "navigate");
        _curlClient.SetDefaultHeader("Sec-Fetch-Dest", "document");
        _curlClient.SetDefaultHeader("Sec-Fetch-User", "?1");
        // Cloudflare 需要的完整客户端提示头部
        _curlClient.SetDefaultHeader("Sec-Ch-Ua", "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Mobile", "?0");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Platform", "\"Windows\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Bitness", "\"64\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Arch", "\"x86\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Full-Version", "\"131.0.0.0\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Full-Version-List", "\"Google Chrome\";v=\"131.0.0.0\", \"Chromium\";v=\"131.0.0.0\", \"Not_A Brand\";v=\"24.0.0.0\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Model", "\"\"");
        _curlClient.SetDefaultHeader("Sec-Ch-Ua-Platform-Version", "\"15.0.0\"");
        
        // 添加 over18 cookie
        _curlClient.SetCookie("over18", "1");
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
        Console.WriteLine($"[DEBUG] 选择结果: JavId={selected.JavId}, DetailUrl={selected.DetailUrl}");

        var result = await GetDetailAsync(selected.DetailUrl);
        if (string.IsNullOrWhiteSpace(result.JavId))
            result.JavId = javId;

        return result;
    }

    public async Task<List<JavSearchResult>> SearchCandidatesAsync(string javId)
    {
        // 尝试所有可用的 URL
        var urls = new List<string> { _config.BaseUrl };
        urls.AddRange(_config.MirrorUrls);
        var lastError = "";

        foreach (var baseUrl in urls)
        {
            try
            {
                var baseUrlTrimmed = baseUrl.TrimEnd('/');

                // 第一步：访问首页建立会话
                var homeResponse = await _curlClient.GetAsync(baseUrlTrimmed);
                if (!homeResponse.IsSuccessStatusCode)
                {
                    lastError = $"首页请求失败: {homeResponse.StatusCode}";
                    if (homeResponse.StatusCode == 403)
                        continue;
                    homeResponse.EnsureSuccessStatusCode();
                }

                // 第二步：访问搜索页面
                var searchUrl = $"{baseUrlTrimmed}/search?q={Uri.EscapeDataString(javId)}&f=all";
                var searchResponse = await _curlClient.GetAsync(searchUrl, baseUrlTrimmed);
                if (!searchResponse.IsSuccessStatusCode)
                {
                    lastError = $"搜索请求失败: {searchResponse.StatusCode}";
                    if (searchResponse.StatusCode == 403)
                        continue;
                    searchResponse.EnsureSuccessStatusCode();
                }
                var html = searchResponse.Body;
                Console.WriteLine($"[DEBUG] 搜索页面 HTML 长度: {html.Length}");

                // 解析搜索结果
                var searchResults = _htmlParser.ParseSearchResults(html);
                Console.WriteLine($"[DEBUG] 解析到搜索结果数量: {searchResults.Count}");

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
                    Console.WriteLine($"[DEBUG] 第一个结果: JavId={first.JavId}, DetailUrl={first.DetailUrl}");
                }

                return deduped;
            }
            catch (Exception ex)
            {
                lastError = $"{baseUrl}: {ex.Message}";
                Console.WriteLine($"[DEBUG] 异常: {lastError}");
                continue;
            }
        }

        throw new InvalidOperationException($"JavDB HTTP 请求失败: {lastError}");
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

        var response = await _curlClient.GetAsync(detailUrl, referer);
        response.EnsureSuccessStatusCode();
        var html = response.Body;

        var result = _htmlParser.ParseDetailPage(html);
        result.DetailUrl = detailUrl;

        // 解析种子链接
        var torrents = ParseTorrentLinks(html);
        result.Torrents = torrents;

        return result;
    }

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
        _curlClient?.Dispose();
    }

    // ========== IHealthChecker 实现 ==========

    /// <summary>
    /// 服务名称
    /// </summary>
    string IHealthChecker.ServiceName => "JavDB (远程数据库)";

    /// <summary>
    /// 检查服务健康状态
    /// </summary>
    public async Task<HealthCheckResult> CheckHealthAsync()
    {
        // 尝试所有可用的 URL
        var urls = new List<string> { _config.BaseUrl };
        urls.AddRange(_config.MirrorUrls);

        foreach (var url in urls)
        {
            try
            {
                var testUrl = $"{url.TrimEnd('/')}";
                var response = await _curlClient.GetAsync(testUrl);

                if (response.IsSuccessStatusCode)
                {
                    return new HealthCheckResult
                    {
                        ServiceName = ((IHealthChecker)this).ServiceName,
                        IsHealthy = true,
                        Message = "服务正常",
                        Url = url
                    };
                }
            }
            catch
            {
                // 继续尝试下一个 URL
                continue;
            }
        }

        return new HealthCheckResult
        {
            ServiceName = ((IHealthChecker)this).ServiceName,
            IsHealthy = false,
            Message = "所有 URL 均无法访问",
            Url = _config.BaseUrl
        };
    }
}

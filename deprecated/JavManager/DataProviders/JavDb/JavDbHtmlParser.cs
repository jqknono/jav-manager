using HtmlAgilityPack;
using JavManager.Core.Models;

namespace JavManager.DataProviders.JavDb;

/// <summary>
/// JavDB HTML 解析器
/// </summary>
public class JavDbHtmlParser
{
    /// <summary>
    /// 解析搜索结果页面
    /// </summary>
    public List<JavSearchResult> ParseSearchResults(string html)
    {
        var results = new List<JavSearchResult>();

        try
        {
            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // 查找视频项（JavDB 的搜索结果在 .item-grid 中）
            var items = doc.DocumentNode.SelectNodes("//div[contains(@class, 'item') and .//a[contains(@class, 'box')]]");

            if (items == null)
                return results;

            foreach (var item in items)
            {
                // 提取链接和标题
                var linkNode = item.SelectSingleNode(".//a[@class='box']");
                if (linkNode == null)
                    continue;

                var detailUrl = linkNode.GetAttributeValue("href", "");
                var titleAttr = linkNode.GetAttributeValue("title", "");
                var titleText = NormalizeInlineText(linkNode.InnerText);
                var title = !string.IsNullOrWhiteSpace(titleAttr) ? titleAttr : titleText;

                // 提取封面图
                var imgNode = item.SelectSingleNode(".//img[contains(@class, 'video-cover')]");
                var dataSrc = imgNode?.GetAttributeValue("data-src", "");
                var coverUrl = !string.IsNullOrEmpty(dataSrc) ? dataSrc :
                              imgNode?.GetAttributeValue("src", "") ?? "";

                // 提取番号
                var javIdNode = item.SelectSingleNode(
                    ".//*[contains(concat(' ', normalize-space(@class), ' '), ' uid ') or " +
                    "contains(concat(' ', normalize-space(@class), ' '), ' video-id ') or " +
                    "contains(concat(' ', normalize-space(@class), ' '), ' video-uid ') or " +
                    "contains(concat(' ', normalize-space(@class), ' '), ' video_id ')]");

                var javId =
                    ExtractJavIdFromText(NormalizeInlineText(javIdNode?.InnerText)) ??
                    ExtractJavIdFromText(NormalizeInlineText(item.InnerText)) ??
                    ExtractJavIdFromAttributes(item) ??
                    ExtractJavIdFromText(title) ??
                    string.Empty;

                results.Add(new JavSearchResult
                {
                    JavId = javId,
                    Title = title,
                    CoverUrl = coverUrl,
                    DetailUrl = detailUrl
                });
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to parse search results: {ex.Message}", ex);
        }

        return results;
    }

    /// <summary>
    /// 解析详情页面
    /// </summary>
    public JavSearchResult ParseDetailPage(string html)
    {
        try
        {
            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // 提取标题
            var titleNode = doc.DocumentNode.SelectSingleNode("//h2[contains(@class, 'title')]");
            var title = NormalizeInlineText(titleNode?.InnerText);

            // 提取番号
            var javIdNode = doc.DocumentNode.SelectSingleNode("//span[contains(@class, 'current-title')]");
            var javId = NormalizeInlineText(javIdNode?.InnerText);
            if (string.IsNullOrWhiteSpace(javId))
                javId = ExtractJavIdFromTitle(title);

            // 提取封面图
            var imgNode = doc.DocumentNode.SelectSingleNode("//img[contains(@class, 'video-cover')]");
            var coverUrl = imgNode?.GetAttributeValue("src", "") ?? "";

            // 提取发布日期
            var releaseDate = ParseMetaField(doc, "發行日期", "日期");
            DateTime.TryParse(releaseDate, out var releaseDateParsed);

            // 提取时长
            var durationStr = ParseMetaField(doc, "時長", "片長");
            var duration = ParseDuration(durationStr);

            // 提取导演
            var director = ParseMetaField(doc, "導演");

            // 提取制作商
            var maker = ParseMetaField(doc, "片商");

            // 提取发行商
            var publisher = ParseMetaField(doc, "發行");

            // 提取系列
            var series = ParseMetaField(doc, "系列");

            // 提取演员列表
            var actors = ParseActors(doc);

            // 提取类别/标签
            var categories = ParseCategories(doc);

            return new JavSearchResult
            {
                JavId = javId,
                Title = title,
                CoverUrl = coverUrl,
                ReleaseDate = releaseDateParsed,
                Duration = duration,
                Director = director,
                Maker = maker,
                Publisher = publisher,
                Series = series,
                Actors = actors,
                Categories = categories,
                Torrents = new List<TorrentInfo>()
            };
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to parse detail page: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 解析元数据字段（支持多个关键词）
    /// </summary>
    private static string ParseMetaField(HtmlDocument doc, params string[] keywords)
    {
        foreach (var keyword in keywords)
        {
            // 尝试不同的选择器模式
            var selectors = new[]
            {
                $"//div[contains(@class, 'video-meta-panel')]//strong[contains(text(), '{keyword}')]/following-sibling::span",
                $"//div[contains(@class, 'video-meta-panel')]//span[contains(text(), '{keyword}')]/following-sibling::span",
                $"//div[contains(@class, 'video-meta-panel')]//span[contains(text(), '{keyword}')]/following-sibling::a",
                $"//div[contains(@class, 'panel-block')]/strong[contains(text(), '{keyword}')]/../span",
                $"//div[contains(@class, 'panel-block')]/strong[contains(text(), '{keyword}')]/../a"
            };

            foreach (var selector in selectors)
            {
                var node = doc.DocumentNode.SelectSingleNode(selector);
                if (node != null)
                {
                    var text = NormalizeInlineText(node.InnerText);
                    if (!string.IsNullOrWhiteSpace(text) && text != "N/A" && text != "-")
                        return text;
                }
            }
        }

        return string.Empty;
    }

    /// <summary>
    /// 解析时长（分钟）
    /// </summary>
    private static int ParseDuration(string durationStr)
    {
        if (string.IsNullOrWhiteSpace(durationStr))
            return 0;

        // 匹配 "123分鐘" 或 "123 min" 或 "1:23:45" 等格式
        var match = System.Text.RegularExpressions.Regex.Match(durationStr, @"(\d+)\s*(?:分鐘|分钟|min)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (match.Success && int.TryParse(match.Groups[1].Value, out var minutes))
            return minutes;

        // 尝试解析纯数字
        if (int.TryParse(durationStr.Trim(), out var number))
            return number;

        return 0;
    }

    /// <summary>
    /// 解析演员列表
    /// </summary>
    private static List<string> ParseActors(HtmlDocument doc)
    {
        var actors = new List<string>();

        // 尝试不同的选择器
        var selectors = new[]
        {
            "//div[contains(@class, 'video-meta-panel')]//strong[contains(text(), '演員')]/following-sibling::span//a",
            "//div[contains(@class, 'video-meta-panel')]//span[contains(text(), '演員')]/following-sibling::span//a",
            "//div[contains(@class, 'panel-block')]/strong[contains(text(), '演員')]/../span//a",
            "//div[contains(@class, 'panel-block')]/strong[contains(text(), '演員')]/..//a[contains(@href, '/actors/')]"
        };

        foreach (var selector in selectors)
        {
            var nodes = doc.DocumentNode.SelectNodes(selector);
            if (nodes != null && nodes.Count > 0)
            {
                foreach (var node in nodes)
                {
                    var name = NormalizeInlineText(node.InnerText);
                    if (!string.IsNullOrWhiteSpace(name) && !actors.Contains(name))
                        actors.Add(name);
                }
                break;
            }
        }

        return actors;
    }

    /// <summary>
    /// 解析类别/标签列表
    /// </summary>
    private static List<string> ParseCategories(HtmlDocument doc)
    {
        var categories = new List<string>();

        // 尝试不同的选择器
        var selectors = new[]
        {
            "//div[contains(@class, 'video-meta-panel')]//strong[contains(text(), '類別')]/following-sibling::span//a",
            "//div[contains(@class, 'video-meta-panel')]//span[contains(text(), '類別')]/following-sibling::span//a",
            "//div[contains(@class, 'panel-block')]/strong[contains(text(), '類別')]/../span//a",
            "//div[contains(@class, 'panel-block')]/strong[contains(text(), '類別')]/..//a[contains(@href, '/tags/')]"
        };

        foreach (var selector in selectors)
        {
            var nodes = doc.DocumentNode.SelectNodes(selector);
            if (nodes != null && nodes.Count > 0)
            {
                foreach (var node in nodes)
                {
                    var name = NormalizeInlineText(node.InnerText);
                    if (!string.IsNullOrWhiteSpace(name) && !categories.Contains(name))
                        categories.Add(name);
                }
                break;
            }
        }

        return categories;
    }

    /// <summary>
    /// 从标题中提取番号
    /// </summary>
    private string ExtractJavIdFromTitle(string title)
    {
        // 匹配常见番号格式: ABC-123, SSIS-001, FC2-1234567
        return ExtractJavIdFromText(title) ?? title;
    }

    private static string? ExtractJavIdFromText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var match = System.Text.RegularExpressions.Regex.Match(
            text,
            @"([A-Z0-9]+-\d+)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Value.ToUpperInvariant() : null;
    }

    private static string? ExtractJavIdFromAttributes(HtmlNode node)
    {
        foreach (var n in node.DescendantsAndSelf())
        {
            if (!n.HasAttributes)
                continue;

            foreach (var attr in n.Attributes)
            {
                if (string.IsNullOrWhiteSpace(attr.Value))
                    continue;

                var id = ExtractJavIdFromText(attr.Value);
                if (!string.IsNullOrWhiteSpace(id))
                    return id;
            }
        }

        return null;
    }

    private static string NormalizeInlineText(string? text)
        => (HtmlEntity.DeEntitize(text ?? string.Empty) ?? string.Empty).Trim();
}

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
                var coverUrl = imgNode?.GetAttributeValue("data-src", "") ??
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
            var title = titleNode?.InnerText.Trim() ?? "";

            // 提取番号
            var javIdNode = doc.DocumentNode.SelectSingleNode("//span[contains(@class, 'current-title')]");
            var javId = javIdNode?.InnerText.Trim() ?? ExtractJavIdFromTitle(title);

            // 提取封面图
            var imgNode = doc.DocumentNode.SelectSingleNode("//img[contains(@class, 'video-cover')]");
            var coverUrl = imgNode?.GetAttributeValue("src", "") ?? "";

            // 提取发布日期
            var dateNode = doc.DocumentNode.SelectSingleNode("//div[contains(@class, 'video-meta-panel')]//span[contains(text(), '發行日期')]/following-sibling::span");
            var dateStr = dateNode?.InnerText.Trim() ?? "";
            DateTime.TryParse(dateStr, out var releaseDate);

            return new JavSearchResult
            {
                JavId = javId,
                Title = title,
                CoverUrl = coverUrl,
                ReleaseDate = releaseDate,
                Torrents = new List<TorrentInfo>()
            };
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to parse detail page: {ex.Message}", ex);
        }
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

    private static string NormalizeInlineText(string? text)
        => (HtmlEntity.DeEntitize(text ?? string.Empty) ?? string.Empty).Trim();
}

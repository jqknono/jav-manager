using System.Text.RegularExpressions;
using JavManager.Core.Models;

namespace JavManager.Utils;

/// <summary>
/// 种子名称解析器
/// </summary>
public partial class TorrentNameParser
{
    /// <summary>
    /// 无码标记正则表达式
    /// </summary>
    [GeneratedRegex(@"-[UC]")]
    private static partial Regex UncensoredRegex();

    /// <summary>
    /// 字幕标记正则表达式
    /// </summary>
    [GeneratedRegex(@"(?:[\u4e00-\u9fa5]+字幕|字幕|[\u4e00-\u9fa5]+|中文字幕)|-\s*C\s*-", RegexOptions.IgnoreCase)]
    private static partial Regex SubtitleRegex();

    /// <summary>
    /// 解析种子名称，提取无码和字幕信息
    /// </summary>
    /// <param name="torrentName">种子名称</param>
    /// <returns>解析后的种子信息</returns>
    public (UncensoredMarkerType UncensoredType, bool HasSubtitle) Parse(string torrentName)
    {
        var uncensoredType = UncensoredMarkerType.None;
        bool hasSubtitle = false;

        // 检测无码标记 -UC, -U, -C
        var match = UncensoredRegex().Match(torrentName);
        if (match.Success)
        {
            var marker = match.Value;
            if (marker.Equals("-UC", StringComparison.OrdinalIgnoreCase))
            {
                uncensoredType = UncensoredMarkerType.UC;
                hasSubtitle = true; // -UC 包含字幕
            }
            else if (marker.Equals("-U", StringComparison.OrdinalIgnoreCase))
            {
                uncensoredType = UncensoredMarkerType.U;
            }
            else if (marker.Equals("-C", StringComparison.OrdinalIgnoreCase))
            {
                uncensoredType = UncensoredMarkerType.C;
                hasSubtitle = true; // -C 表示字幕
            }
        }

        // 检测字幕标记（如果不是 -UC 或 -C）
        if (!hasSubtitle)
        {
            hasSubtitle = SubtitleRegex().IsMatch(torrentName);
        }

        return (uncensoredType, hasSubtitle);
    }

    /// <summary>
    /// 从种子名称创建 TorrentInfo 对象
    /// </summary>
    /// <param name="title">种子标题</param>
    /// <param name="magnetLink">磁力链接</param>
    /// <param name="size">文件大小</param>
    /// <param name="seeders">做种人数</param>
    /// <param name="leechers">下载人数</param>
    /// <returns>TorrentInfo 对象</returns>
    public TorrentInfo CreateTorrentInfo(
        string title,
        string magnetLink,
        long size,
        int seeders = 0,
        int leechers = 0)
    {
        var (uncensoredType, hasSubtitle) = Parse(title);

        return new TorrentInfo
        {
            Title = title,
            MagnetLink = magnetLink,
            Size = size,
            Seeders = seeders,
            Leechers = leechers,
            HasUncensoredMarker = uncensoredType != UncensoredMarkerType.None,
            UncensoredMarkerType = uncensoredType,
            HasSubtitle = hasSubtitle
        };
    }

    /// <summary>
    /// 标准化番号格式
    /// </summary>
    /// <param name="javId">原始番号</param>
    /// <returns>标准化的番号 (如 XXX-123)</returns>
    public string NormalizeJavId(string javId)
    {
        // 移除空格和下划线，转为大写
        var normalized = javId.Replace(" ", "").Replace("_", "-").ToUpper();

        // 匹配常见番号格式
        // 如: ABC-123, SSIS-001, FC2-1234567
        var match = Regex.Match(normalized, @"^[A-Z0-9]+-\d+$");
        if (match.Success)
        {
            return match.Value;
        }

        return normalized;
    }
}

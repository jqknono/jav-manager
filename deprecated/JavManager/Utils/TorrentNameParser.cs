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
    [GeneratedRegex(@"-(?:UC|U)(?=$|[^A-Za-z0-9])", RegexOptions.IgnoreCase)]
    private static partial Regex UncensoredRegex();

    /// <summary>
    /// 解析种子名称，提取无码信息（字幕不从标题推断）
    /// </summary>
    /// <param name="torrentName">种子名称</param>
    /// <returns>解析后的种子信息</returns>
    public (UncensoredMarkerType UncensoredType, bool HasSubtitle) Parse(string torrentName)
    {
        var uncensoredType = UncensoredMarkerType.None;
        bool hasSubtitle = false;

        // 检测无码标记 -UC, -U
        var match = UncensoredRegex().Match(torrentName);
        if (match.Success)
        {
            var marker = match.Value;
            if (marker.Equals("-UC", StringComparison.OrdinalIgnoreCase))
            {
                uncensoredType = UncensoredMarkerType.UC;
            }
            else if (marker.Equals("-U", StringComparison.OrdinalIgnoreCase))
            {
                uncensoredType = UncensoredMarkerType.U;
            }
        }

        // 种子名中包含“无码/無碼/uncensored”也视为无码
        if (uncensoredType == UncensoredMarkerType.None &&
            (torrentName.Contains("无码", StringComparison.OrdinalIgnoreCase) ||
             torrentName.Contains("無碼", StringComparison.OrdinalIgnoreCase) ||
             torrentName.Contains("uncensored", StringComparison.OrdinalIgnoreCase)))
        {
            uncensoredType = UncensoredMarkerType.U;
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
        var normalized = javId.Trim().Replace("_", "-").ToUpper();
        var noSpaces = normalized.Replace(" ", "");

        // 先匹配完整番号格式
        // 如: ABC-123, SSIS-001, FC2-1234567
        var match = Regex.Match(noSpaces, @"^[A-Z0-9]+-\d+$");
        if (match.Success)
            return match.Value;

        // 再从标题中提取番号（如: IPZZ-408-UC.torrent.无码破解 -> IPZZ-408）
        var extractable = Regex.Replace(normalized, @"[^A-Z0-9-]+", " ");
        match = Regex.Match(extractable, @"\b[A-Z0-9]+-\d+\b");
        if (match.Success)
            return match.Value;

        return noSpaces;
    }
}

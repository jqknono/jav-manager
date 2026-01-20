using System.Text.RegularExpressions;

namespace JavManager.Utils;

public static class SizeParser
{
    public static long MB(long value) => value * 1024L * 1024L;

    public static bool TryParseToBytes(string? text, out long bytes)
    {
        bytes = 0;
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var input = text.Trim();

        // Allow plain integer bytes
        if (long.TryParse(input, out var raw) && raw >= 0)
        {
            bytes = raw;
            return true;
        }

        // Examples: 100MB, 100 MB, 1.5GB, 1024KiB, 1G
        var match = Regex.Match(
            input,
            @"(?i)^\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|KIB|MIB|GIB|TIB|K|M|G|T)\s*$");

        if (!match.Success)
            return false;

        if (!double.TryParse(
                match.Groups[1].Value,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var value) ||
            value < 0)
        {
            return false;
        }

        var unit = match.Groups[2].Value.ToUpperInvariant();
        var multiplier = unit switch
        {
            "B" => 1d,
            "KB" or "KIB" or "K" => 1024d,
            "MB" or "MIB" or "M" => 1024d * 1024d,
            "GB" or "GIB" or "G" => 1024d * 1024d * 1024d,
            "TB" or "TIB" or "T" => 1024d * 1024d * 1024d * 1024d,
            _ => 0d
        };

        if (multiplier <= 0)
            return false;

        var result = value * multiplier;
        if (result > long.MaxValue)
            return false;

        bytes = (long)result;
        return true;
    }
}


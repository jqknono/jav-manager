using System;

namespace JavManager.Gui.Utils;

public static class UiMessageFormatter
{
    /// <summary>
    /// Split a user-facing message into a short summary + optional details.
    /// Uses a human-readable separator:
    /// - ": " (English style)
    /// - "：" (Chinese full-width colon, optionally followed by a space)
    /// This avoids splitting URLs like "http://...".
    /// </summary>
    public static (string Summary, string Details) ToSummaryAndDetails(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return (string.Empty, string.Empty);

        var trimmed = message.Trim();
        var asciiSeparatorIndex = trimmed.IndexOf(": ", StringComparison.Ordinal);
        var fullWidthSeparatorIndex = trimmed.IndexOf('：', StringComparison.Ordinal);

        var separatorIndex = -1;
        var separatorLength = 0;

        if (asciiSeparatorIndex >= 0 && (fullWidthSeparatorIndex < 0 || asciiSeparatorIndex < fullWidthSeparatorIndex))
        {
            separatorIndex = asciiSeparatorIndex;
            separatorLength = 2;
        }
        else if (fullWidthSeparatorIndex >= 0)
        {
            separatorIndex = fullWidthSeparatorIndex;
            separatorLength = 1;
            if (separatorIndex + 1 < trimmed.Length && trimmed[separatorIndex + 1] == ' ')
                separatorLength = 2;
        }

        if (separatorIndex <= 0)
            return (trimmed, string.Empty);

        var summary = trimmed[..separatorIndex].Trim();
        var details = trimmed[(separatorIndex + separatorLength)..].Trim();
        return (summary, details);
    }
}

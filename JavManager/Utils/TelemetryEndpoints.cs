using System;

namespace JavManager.Utils;

public static class TelemetryEndpoints
{
    public const string DefaultBaseEndpoint = "https://jav-manager.techfetch.dev";

    public static string GetTelemetryPostUrl(string? baseEndpoint)
        => $"{GetBaseEndpoint(baseEndpoint)}/api/telemetry";

    public static string GetJavInfoPostUrl(string? baseEndpoint)
        => $"{GetBaseEndpoint(baseEndpoint)}/api/javinfo";

    public static string GetBaseEndpoint(string? baseEndpoint)
    {
        var normalized = NormalizeBaseEndpointOrNull(baseEndpoint);
        return string.IsNullOrWhiteSpace(normalized) ? DefaultBaseEndpoint : normalized;
    }

    public static string? NormalizeBaseEndpointOrNull(string? endpoint)
    {
        if (string.IsNullOrWhiteSpace(endpoint))
            return null;

        endpoint = endpoint.Trim();

        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
            return endpoint.TrimEnd('/');

        var path = (uri.AbsolutePath ?? string.Empty).TrimEnd('/');

        if (path.EndsWith("/api/telemetry", StringComparison.OrdinalIgnoreCase))
            path = path[..^"/api/telemetry".Length];
        else if (path.EndsWith("/api/javinfo", StringComparison.OrdinalIgnoreCase))
            path = path[..^"/api/javinfo".Length];
        else if (path.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
            path = path[..^"/api".Length];

        path = path.TrimEnd('/');

        var builder = new UriBuilder(uri)
        {
            Path = path,
            Query = string.Empty,
            Fragment = string.Empty
        };

        return builder.Uri.ToString().TrimEnd('/');
    }
}


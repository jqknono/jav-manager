using System.Net;
using System.Net.Http;
using System.Security.Authentication;
using Spectre.Console;

namespace JavManager;

/// <summary>
/// JavDB 连接诊断工具
/// 使用与 JavDbWebScraper 相同的伪装策略
/// </summary>
public static class TestCurl
{
    private const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    public static async Task RunTestAsync()
    {
        var urls = new[] { "https://javdb.com", "https://javdb565.com", "https://javdb564.com" };
        var userAgent = DefaultUserAgent;

        var cookies = new CookieContainer();
        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 10,
            UseCookies = true,
            CookieContainer = cookies,
            ConnectTimeout = TimeSpan.FromSeconds(15),
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            // HTTP/1.1：Cloudflare 对 HTTP/1.1 的指纹检测较宽松
            EnableMultipleHttp2Connections = false,
            SslOptions = new System.Net.Security.SslClientAuthenticationOptions
            {
                EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13
            }
        };

        using var httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };
        // 强制 HTTP/1.1
        httpClient.DefaultRequestVersion = HttpVersion.Version11;
        httpClient.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact;

        AnsiConsole.MarkupLine("[bold cyan]=========================================[/]");
        AnsiConsole.MarkupLine("[bold cyan]JavDB Connection Diagnostic[/]");
        AnsiConsole.MarkupLine("[bold cyan]=========================================[/]");
        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine($"[grey]Protocol: HTTP/1.1 (bypasses HTTP/2 fingerprinting)[/]");
        AnsiConsole.MarkupLine($"[grey]User-Agent: {Markup.Escape(userAgent)}[/]");
        AnsiConsole.WriteLine();

        var anySuccess = false;

        foreach (var url in urls)
        {
            var uri = new Uri(url);
            cookies.Add(uri, new Cookie("over18", "1", "/"));
            cookies.Add(uri, new Cookie("locale", "zh", "/"));

            // 添加小延迟模拟人类行为
            await Task.Delay(Random.Shared.Next(200, 600));

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            ApplyChromeHeaders(request, userAgent);

            try
            {
                using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                var statusCode = (int)response.StatusCode;
                var isCloudflare = response.Headers.Contains("cf-mitigated") ||
                                   response.Headers.Contains("cf-ray");

                var statusText = statusCode switch
                {
                    200 => $"[green]OK (HTTP {statusCode})[/]",
                    403 when isCloudflare => $"[red]BLOCKED (HTTP 403 - Cloudflare)[/]",
                    403 => $"[red]FORBIDDEN (HTTP 403)[/]",
                    _ => $"[yellow]HTTP {statusCode}[/]"
                };
                AnsiConsole.MarkupLine($"   {url} ... {statusText}");

                if (statusCode == 200)
                    anySuccess = true;
            }
            catch (Exception ex)
            {
                AnsiConsole.MarkupLine($"   {url} ... [red]ERROR: {Markup.Escape(ex.Message)}[/]");
            }
        }

        AnsiConsole.WriteLine();

        if (anySuccess)
        {
            AnsiConsole.MarkupLine("[green]At least one mirror is accessible. JavDB search should work.[/]");
        }
        else
        {
            AnsiConsole.MarkupLine("[yellow]All URLs blocked by Cloudflare.[/]");
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine("[bold]To bypass Cloudflare challenge:[/]");
            AnsiConsole.MarkupLine("   1. Open browser, visit https://javdb.com");
            AnsiConsole.MarkupLine("   2. Complete any Cloudflare challenge");
            AnsiConsole.MarkupLine("   3. Open DevTools (F12) -> Application -> Cookies");
            AnsiConsole.MarkupLine("   4. Copy [yellow]cf_clearance[/] cookie value");
            AnsiConsole.MarkupLine("   5. Add to appsettings.json or environment:");
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine("[grey]   appsettings.json:[/]");
            AnsiConsole.MarkupLine("[grey]   \"JavDb\": { \"CfClearance\": \"your_value\", \"UserAgent\": \"...\" }[/]");
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine("[grey]   Or environment variables:[/]");
            AnsiConsole.MarkupLine("[grey]   JAVMANAGER_JavDb__CfClearance=your_value[/]");
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine("[grey]See: doc/CloudflareBypass.md[/]");
        }
    }

    private static void ApplyChromeHeaders(HttpRequestMessage request, string userAgent)
    {
        var chromeMajor = ParseChromeMajorVersion(userAgent);
        var platform = GetPlatformFromUserAgent(userAgent);
        var mobile = userAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase) ? "?1" : "?0";

        // Chrome 真实请求的 header 顺序
        request.Headers.TryAddWithoutValidation("Connection", "keep-alive");
        request.Headers.TryAddWithoutValidation("Cache-Control", "max-age=0");
        request.Headers.TryAddWithoutValidation("sec-ch-ua", BuildSecChUa(chromeMajor));
        request.Headers.TryAddWithoutValidation("sec-ch-ua-mobile", mobile);
        request.Headers.TryAddWithoutValidation("sec-ch-ua-platform", $"\"{platform}\"");
        request.Headers.TryAddWithoutValidation("DNT", "1");
        request.Headers.TryAddWithoutValidation("Upgrade-Insecure-Requests", "1");
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        request.Headers.TryAddWithoutValidation("Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "none");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "navigate");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-User", "?1");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "document");
        request.Headers.TryAddWithoutValidation("Accept-Encoding", "gzip, deflate, br");
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
}

using JavManager.Core.Configuration.ConfigSections;
using JavManager.DataProviders.JavDb;
using JavManager.Localization;
using Microsoft.Extensions.Configuration;
using Spectre.Console;

namespace JavManager;

/// <summary>
/// curl-impersonate 连接诊断工具（默认策略）
/// </summary>
public static class TestCurl
{
    public static async Task RunTestAsync(IConfiguration configuration, LocalizationService _)
    {
        var javDbConfig = configuration.GetSection("JavDb").Get<JavDbConfig>() ?? new JavDbConfig();

        var urls = new List<string>();
        if (!string.IsNullOrWhiteSpace(javDbConfig.BaseUrl))
            urls.Add(javDbConfig.BaseUrl.Trim());
        if (javDbConfig.MirrorUrls != null)
            urls.AddRange(javDbConfig.MirrorUrls.Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u.Trim()));

        urls = urls
            .Select(u => u.Trim().TrimEnd('/'))
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        AnsiConsole.MarkupLine("[bold cyan]=========================================[/]");
        AnsiConsole.MarkupLine("[bold cyan]JavDB curl-impersonate Diagnostic[/]");
        AnsiConsole.MarkupLine("[bold cyan]=========================================[/]");
        AnsiConsole.WriteLine();

        if (!javDbConfig.CurlImpersonate.Enabled)
        {
            AnsiConsole.MarkupLine("[yellow]Warning: JavDb:CurlImpersonate:Enabled is false in config.[/]");
            AnsiConsole.MarkupLine("[yellow]This diagnostic still tries to call curl-impersonate directly.[/]");
            AnsiConsole.WriteLine();
        }

        var fetcher = new CurlImpersonateHttpFetcher(javDbConfig);
        var anySuccess = false;

        // Not for Cloudflare bypass; only for JavDB's age/locale preferences.
        const string cookieHeader = "over18=1; locale=zh";

        foreach (var url in urls)
        {
            await Task.Delay(Random.Shared.Next(200, 600));

            var (statusCode, _, error) = await fetcher.GetAsync(
                url,
                referer: null,
                cookieHeader: cookieHeader,
                timeoutMs: 15_000,
                cancellationToken: CancellationToken.None);

            if (statusCode >= 200 && statusCode < 300)
            {
                anySuccess = true;
                AnsiConsole.MarkupLine($"   {Markup.Escape(url)} ... [green]OK (HTTP {statusCode})[/]");
                continue;
            }

            var errorText = string.IsNullOrWhiteSpace(error) ? string.Empty : $" [grey]error={Markup.Escape(error)}[/]";
            AnsiConsole.MarkupLine($"   {Markup.Escape(url)} ... [red]FAILED (HTTP {statusCode})[/]{errorText}");
        }

        AnsiConsole.WriteLine();
        if (anySuccess)
        {
            AnsiConsole.MarkupLine("[green]At least one JavDB URL is accessible via curl-impersonate.[/]");
        }
        else
        {
            AnsiConsole.MarkupLine("[yellow]All JavDB URLs failed via curl-impersonate.[/]");
            AnsiConsole.MarkupLine("[grey]Check network/IP and ensure native libs exist under JavManager/native/curl-impersonate/<rid>/.[/]");
        }
    }
}

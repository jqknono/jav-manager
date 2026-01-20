using Spectre.Console;
using JavManager.Core.Models;
using JavManager.Core.Interfaces;
using JavManager.Services;

namespace JavManager.ConsoleUI;

/// <summary>
/// 显示服务
/// </summary>
public class DisplayService
{
    /// <summary>
    /// 显示欢迎信息
    /// </summary>
    public void ShowWelcome()
    {
        try
        {
            Console.Clear();
        }
        catch
        {
            // 忽略清除控制台失败（在非交互式环境中）
        }
        AnsiConsole.Write(
            new FigletText("JAV Manager")
                .Centered()
                .Color(Color.Blue));

        AnsiConsole.WriteLine();
        AnsiConsole.Write(
            new Rule("[yellow]JAV 下载管理器[/]")
                .RuleStyle("grey")
                .Centered());

        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine("[green]功能:[/]");
        AnsiConsole.MarkupLine("  • 从 JavDB 搜索番号");
        AnsiConsole.MarkupLine("  • 智能选择最优片源（无码/字幕/大小）");
        AnsiConsole.MarkupLine("  • 本地文件检查（使用 Everything）");
        AnsiConsole.MarkupLine("  • 自动添加到 qBittorrent");
        AnsiConsole.WriteLine();

        AnsiConsole.MarkupLine("[green]命令:[/]");
        AnsiConsole.MarkupLine(Markup.Escape("  • <番号> / s <番号>        搜索并下载（例如 IPZZ-408）"));
        AnsiConsole.MarkupLine(Markup.Escape("  • l <番号> [-m 100MB]       本地搜索（Everything，默认只显示 >=100MB）"));
        AnsiConsole.MarkupLine(Markup.Escape("  • r <番号>                  远端搜索（JavDB）"));
        AnsiConsole.MarkupLine(Markup.Escape("  • d                         正在下载列表（qBittorrent）"));
        AnsiConsole.MarkupLine(Markup.Escape("  • t                         下载任务列表（qBittorrent）"));
        AnsiConsole.MarkupLine(Markup.Escape("  • h                         显示帮助"));
        AnsiConsole.MarkupLine(Markup.Escape("  • q                         退出"));
        AnsiConsole.WriteLine();
    }

    /// <summary>
    /// 显示处理结果
    /// </summary>
    public void ShowProcessResult(JavSearchProcessResult result)
    {
        AnsiConsole.WriteLine();

        if (result.Success)
        {
            if (result.LocalFilesFound)
            {
                AnsiConsole.MarkupLine("[yellow]⚠ 本地文件已存在[/]");
                foreach (var file in result.LocalFiles)
                {
                    AnsiConsole.MarkupLine($"  • [cyan]{Markup.Escape(file.FileName)}[/] ({FormatSize(file.Size)})");
                }
            }
            else if (result.Downloaded)
            {
                AnsiConsole.MarkupLine("[green]✓ 下载任务已添加[/]");
                if (result.SelectedTorrent != null)
                {
                    AnsiConsole.MarkupLine($"  • [cyan]{Markup.Escape(result.SelectedTorrent.Title)}[/]");
                    var markers = new List<string>();
                    if (result.SelectedTorrent.HasHd) markers.Add("高清");
                    if (result.SelectedTorrent.HasUncensoredMarker) markers.Add("无码");
                    if (result.SelectedTorrent.HasSubtitle) markers.Add("字幕");
                    var markerText = markers.Count > 0 ? string.Join(", ", markers) : "无";
                    AnsiConsole.MarkupLine($"  • 标记: {Markup.Escape(markerText)} ({result.SelectedTorrent.WeightScore:0})");
                }
            }
        }
        else
        {
            AnsiConsole.MarkupLine("[red]✗ 处理失败[/]");
        }

        // 显示详细信息
        if (result.Message.Length > 0)
        {
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine("[grey]────────────────────────────────────────[/]");
            AnsiConsole.Write(result.Message.ToString());
            AnsiConsole.MarkupLine("[grey]────────────────────────────────────────[/]");
        }
    }

    /// <summary>
    /// 显示搜索结果
    /// </summary>
    public void ShowSearchResults(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
        {
            AnsiConsole.MarkupLine("[red]未找到种子[/]");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn("[yellow]#[/]");
        table.AddColumn("[yellow]标题[/]");
        table.AddColumn("[yellow]无码[/]");
        table.AddColumn("[yellow]字幕[/]");
        table.AddColumn("[yellow]高清[/]");
        table.AddColumn("[yellow]大小[/]");

        for (int i = 0; i < torrents.Count; i++)
        {
            var t = torrents[i];
            var safeTitle = Markup.Escape(t.Title.Truncate(40));
            table.AddRow(
                (i + 1).ToString(),
                safeTitle,
                t.HasUncensoredMarker ? "[green]✓[/]" : "-",
                t.HasSubtitle ? "[green]✓[/]" : "-",
                t.HasHd ? "[green]✓[/]" : "-",
                FormatSize(t.Size)
            );
        }

        AnsiConsole.Write(table);
    }

    public void ShowJavDbCandidates(List<JavSearchResult> candidates)
    {
        if (candidates.Count == 0)
        {
            AnsiConsole.MarkupLine("[red]未找到搜索结果[/]");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn("[yellow]#[/]");
        table.AddColumn("[yellow]番号[/]");
        table.AddColumn("[yellow]标题[/]");

        for (int i = 0; i < candidates.Count; i++)
        {
            var c = candidates[i];
            var displayId = ExtractDisplayJavId(c);
            var safeTitle = Markup.Escape((c.Title ?? string.Empty).Truncate(80));
            table.AddRow(
                (i + 1).ToString(),
                Markup.Escape(displayId),
                safeTitle
            );
        }

        AnsiConsole.Write(table);
    }

    private static string ExtractDisplayJavId(JavSearchResult candidate)
    {
        var text = candidate.JavId;
        if (string.IsNullOrWhiteSpace(text))
            text = candidate.Title;

        var match = System.Text.RegularExpressions.Regex.Match(
            text ?? string.Empty,
            @"([A-Z0-9]+-\d+)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        return match.Success ? match.Value.ToUpperInvariant() : "-";
    }

    /// <summary>
    /// 显示错误信息
    /// </summary>
    public void ShowDownloadList(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
        {
            AnsiConsole.MarkupLine("[yellow]暂无下载任务[/]");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn("[yellow]#[/]");
        table.AddColumn("[yellow]名称[/]");
        table.AddColumn("[yellow]进度[/]");
        table.AddColumn("[yellow]状态[/]");
        table.AddColumn("[yellow]大小[/]");

        for (int i = 0; i < torrents.Count; i++)
        {
            var t = torrents[i];
            var safeTitle = Markup.Escape(t.Title.Truncate(50));

            var progressText = "-";
            if (t.Progress.HasValue)
            {
                var p = t.Progress.Value;
                progressText = p is >= 0 and <= 1
                    ? $"{p * 100:0.##}%"
                    : $"{p:0.##}";
            }

            table.AddRow(
                (i + 1).ToString(),
                safeTitle,
                Markup.Escape(progressText),
                Markup.Escape((t.State ?? "-").Truncate(20)),
                FormatSize(t.Size)
            );
        }

        AnsiConsole.Write(table);
    }

    public void ShowError(string message)
    {
        AnsiConsole.MarkupLine($"[red]错误: {Markup.Escape(message)}[/]");
    }

    /// <summary>
    /// 显示信息
    /// </summary>
    public void ShowInfo(string message)
    {
        AnsiConsole.MarkupLine($"[blue]{Markup.Escape(message)}[/]");
    }

    /// <summary>
    /// 显示成功信息
    /// </summary>
    public void ShowSuccess(string message)
    {
        AnsiConsole.MarkupLine($"[green]✓ {Markup.Escape(message)}[/]");
    }

    /// <summary>
    /// 显示警告信息
    /// </summary>
    public void ShowWarning(string message)
    {
        AnsiConsole.MarkupLine($"[yellow]⚠ {Markup.Escape(message)}[/]");
    }

    /// <summary>
    /// 显示加载动画
    /// </summary>
    public async Task ShowLoadingAsync(string message, Func<Task> action)
    {
        // 简化版本：显示消息，执行操作
        AnsiConsole.MarkupLine($"[blue]{Markup.Escape(message)}...[/]");
        await action();
    }

    /// <summary>
    /// 显示本地文件信息
    /// </summary>
    public void ShowLocalFileInfo(List<LocalFileInfo> files)
    {
        if (files.Count == 0)
        {
            ShowInfo("未找到本地文件。");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn("[yellow]#[/]");
        table.AddColumn("[yellow]文件名[/]");
        table.AddColumn("[yellow]路径[/]");
        table.AddColumn("[yellow]大小[/]");

        for (int i = 0; i < files.Count; i++)
        {
            var file = files[i];
            table.AddRow(
                (i + 1).ToString(),
                Markup.Escape(file.FileName),
                Markup.Escape(file.FullPath),
                FormatSize(file.Size)
            );
        }

        AnsiConsole.Write(table);
    }

    /// <summary>
    /// 格式化文件大小
    /// </summary>
    private string FormatSize(long bytes)
    {
        if (bytes <= 0)
            return "-";

        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        double len = bytes;
        int order = 0;

        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }

        return $"{len:0.##} {sizes[order]}";
    }

    /// <summary>
    /// 显示健康检查结果
    /// </summary>
    public void ShowHealthCheckResults(List<HealthCheckResult> results)
    {
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Rule("[yellow]服务状态检查[/]").RuleStyle("grey"));
        AnsiConsole.WriteLine();

        if (results.Count == 0)
        {
            AnsiConsole.MarkupLine("[yellow]未注册任何健康检查器，无法显示服务状态。[/]");
            AnsiConsole.WriteLine();
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn("[yellow]服务[/]");
        table.AddColumn("[yellow]状态[/]");
        table.AddColumn("[yellow]信息[/]");
        table.AddColumn("[yellow]URL[/]");

        foreach (var result in results)
        {
            var status = result.IsHealthy ? "[green]✓ 正常[/]" : "[red]✗ 异常[/]";
            var messageText = Markup.Escape(result.Message);
            var message = result.IsHealthy ? messageText : $"[red]{messageText}[/]";
            var urlText = (result.Url ?? "-").Truncate(40);
            var url = Markup.Escape(urlText);

            table.AddRow(
                Markup.Escape(result.ServiceName),
                status,
                message,
                url
            );
        }

        AnsiConsole.Write(table);
        AnsiConsole.WriteLine();

        // 如果有服务不健康，显示警告
        var unhealthyCount = results.Count(r => !r.IsHealthy);
        if (unhealthyCount > 0)
        {
            AnsiConsole.MarkupLine($"[red]警告: {unhealthyCount} 个服务不可用，请检查配置文件 appsettings.json[/]");
            ShowDependencySetupHints(results.Where(r => !r.IsHealthy).ToList());
            AnsiConsole.MarkupLine("[yellow]提示: 输入 'quit' 退出程序修改配置[/]");
            AnsiConsole.WriteLine();
        }
        else
        {
            AnsiConsole.MarkupLine("[green]所有服务运行正常[/]");
            AnsiConsole.WriteLine();
        }
    }

    public void ShowDependencySetupHints(List<HealthCheckResult> unhealthyResults)
    {
        if (unhealthyResults.Count == 0)
            return;

        foreach (var r in unhealthyResults)
        {
            if (r.ServiceName.Contains("Everything", StringComparison.OrdinalIgnoreCase))
            {
                AnsiConsole.MarkupLine("[yellow]未检测到 Everything 本地检索服务，请安装并启用 HTTP API：[/]");
                AnsiConsole.MarkupLine($"  • Everything 1.5a: {Markup.Escape("https://www.voidtools.com/everything-1.5a/")}");
                AnsiConsole.MarkupLine($"  • Everything HTTP 插件: {Markup.Escape("https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799")}");
                AnsiConsole.MarkupLine("  • 配置: 将 appsettings.json 的 Everything.BaseUrl 指向 HTTP 服务地址（需包含端口，例如 http://127.0.0.1:1234）");
                AnsiConsole.WriteLine();
            }
            else if (r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase))
            {
                AnsiConsole.MarkupLine("[yellow]未检测到 qBittorrent 下载器 WebUI，请安装并启用 WebUI：[/]");
                AnsiConsole.MarkupLine($"  • qBittorrent: {Markup.Escape("https://github.com/qbittorrent/qBittorrent")}");
                AnsiConsole.MarkupLine($"  • Enhanced Edition: {Markup.Escape("https://github.com/c0re100/qBittorrent-Enhanced-Edition")}");
                AnsiConsole.MarkupLine("  • 配置: 启用 WebUI 后，将 appsettings.json 的 QBittorrent.BaseUrl 指向 WebUI 地址（需包含端口，例如 http://127.0.0.1:8080），并设置正确的账号密码");
                AnsiConsole.WriteLine();
            }
        }
    }
}

/// <summary>
/// 字符串扩展
/// </summary>
public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        return value.Length <= maxLength
            ? value
            : value.Substring(0, maxLength) + "...";
    }
}

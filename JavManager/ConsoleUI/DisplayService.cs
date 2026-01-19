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
        table.AddColumn("[yellow]高清[/]");
        table.AddColumn("[yellow]无码[/]");
        table.AddColumn("[yellow]字幕[/]");
        table.AddColumn("[yellow]大小[/]");

        for (int i = 0; i < torrents.Count; i++)
        {
            var t = torrents[i];
            var safeTitle = Markup.Escape(t.Title.Truncate(40));
            table.AddRow(
                (i + 1).ToString(),
                safeTitle,
                t.HasHd ? "[green]✓[/]" : "-",
                t.HasUncensoredMarker ? "[green]✓[/]" : "-",
                t.HasSubtitle ? "[green]✓[/]" : "-",
                FormatSize(t.Size)
            );
        }

        AnsiConsole.Write(table);
    }

    /// <summary>
    /// 显示错误信息
    /// </summary>
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
            AnsiConsole.MarkupLine("[yellow]提示: 输入 'quit' 退出程序修改配置[/]");
            AnsiConsole.WriteLine();
        }
        else
        {
            AnsiConsole.MarkupLine("[green]所有服务运行正常[/]");
            AnsiConsole.WriteLine();
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

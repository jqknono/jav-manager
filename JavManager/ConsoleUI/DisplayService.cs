using System.IO;
using Spectre.Console;
using JavManager.Core.Models;
using JavManager.Core.Interfaces;
using JavManager.Services;
using JavManager.Localization;

namespace JavManager.ConsoleUI;

/// <summary>
/// 显示服务
/// </summary>
public class DisplayService
{
    private readonly LocalizationService _loc;

    private const string LogInfoPrefix = "[INFO] ";
    private const string LogWarnPrefix = "[WARN] ";
    private const string LogErrorPrefix = "[ERROR] ";
    private const string LogSuccessPrefix = "[OK] ";

    public DisplayService(LocalizationService localizationService)
    {
        _loc = localizationService;
    }

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
            new Rule($"[yellow]{Markup.Escape(_loc.Get(L.AppSubtitle))}[/]")
                .RuleStyle("grey")
                .Centered());
        AnsiConsole.MarkupLine($"[grey]{Markup.Escape(JavManager.Utils.AppInfo.Name)} {Markup.Escape(JavManager.Utils.AppInfo.Version)}[/]");

        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine($"[green]{Markup.Escape(_loc.Get(L.Features))}[/]");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.FeatureSearchJavDb))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.FeatureSmartSelection))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.FeatureLocalCheck))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.FeatureAutoDownload))}");
        AnsiConsole.WriteLine();

        AnsiConsole.MarkupLine($"[green]{Markup.Escape(_loc.Get(L.Commands))}[/]");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdSearchDownload))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdLocalSearch))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdRemoteSearch))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdDownloading))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdDownloads))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdHealthCheck))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdVersion))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdHelp))}");
        AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.CmdQuit))}");
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
                AnsiConsole.MarkupLine($"[yellow]⚠ {Markup.Escape(_loc.Get(L.LocalFilesExist))}[/]");
                foreach (var file in result.LocalFiles)
                {
                    AnsiConsole.MarkupLine($"  • [cyan]{Markup.Escape(file.FileName)}[/] ({FormatSize(file.Size)})");
                }
            }
            else if (result.Downloaded)
            {
                AnsiConsole.MarkupLine($"[green]✓ {Markup.Escape(_loc.Get(L.DownloadAdded))}[/]");
                if (result.SelectedTorrent != null)
                {
                    AnsiConsole.MarkupLine($"  • [cyan]{Markup.Escape(result.SelectedTorrent.Title)}[/]");
                    var markers = new List<string>();
                    if (result.SelectedTorrent.HasHd) markers.Add(_loc.Get(L.MarkerHD));
                    if (result.SelectedTorrent.HasUncensoredMarker) markers.Add(_loc.Get(L.MarkerUncensored));
                    if (result.SelectedTorrent.HasSubtitle) markers.Add(_loc.Get(L.MarkerSubtitle));
                    var markerText = markers.Count > 0 ? string.Join(", ", markers) : _loc.Get(L.MarkerNone);
                    AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.Markers))}: {Markup.Escape(markerText)} ({result.SelectedTorrent.WeightScore:0})");
                }
            }
            else if (result.DownloadQueueSkipped && !string.IsNullOrWhiteSpace(result.MagnetLink))
            {
                AnsiConsole.MarkupLine($"[yellow]⚠ {Markup.Escape(_loc.Get(L.DownloadSkipped))}[/]");
                if (result.SelectedTorrent != null)
                {
                    AnsiConsole.MarkupLine($"  • [cyan]{Markup.Escape(result.SelectedTorrent.Title)}[/]");
                }

                AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.MagnetLinkManual))}[/]");
                AnsiConsole.WriteLine(result.MagnetLink);
            }

            if (!result.LocalFilesFound && result.LocalDedupSkipped)
            {
                AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.LocalDedupSkipped))}[/]");
            }
        }
        else
        {
            AnsiConsole.MarkupLine($"[red]✗ {Markup.Escape(_loc.Get(L.ProcessFailed))}[/]");
        }

        // 显示详细信息
        if (result.Message.Length > 0)
        {
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine("[grey]────────────────────────────────────────[/]");
            RenderProcessLog(result.Message.ToString());
            AnsiConsole.MarkupLine("[grey]────────────────────────────────────────[/]");
        }
    }

    private static void RenderProcessLog(string text)
    {
        using var reader = new StringReader(text);
        string? line;

        while ((line = reader.ReadLine()) != null)
        {
            if (line.Length == 0)
            {
                AnsiConsole.WriteLine();
                continue;
            }

            var color = "grey";
            var content = line;

            if (content.StartsWith(LogInfoPrefix, StringComparison.Ordinal))
            {
                color = "grey";
                content = content.Substring(LogInfoPrefix.Length);
            }
            else if (content.StartsWith(LogWarnPrefix, StringComparison.Ordinal))
            {
                color = "yellow";
                content = content.Substring(LogWarnPrefix.Length);
            }
            else if (content.StartsWith(LogErrorPrefix, StringComparison.Ordinal))
            {
                color = "red";
                content = content.Substring(LogErrorPrefix.Length);
            }
            else if (content.StartsWith(LogSuccessPrefix, StringComparison.Ordinal))
            {
                color = "green";
                content = content.Substring(LogSuccessPrefix.Length);
            }

            if (string.IsNullOrEmpty(content))
            {
                AnsiConsole.WriteLine();
                continue;
            }

            if (content.StartsWith("magnet:", StringComparison.OrdinalIgnoreCase))
                color = "cyan";

            AnsiConsole.MarkupLine($"[{color}]{Markup.Escape(content)}[/]");
        }
    }

    /// <summary>
    /// 显示搜索结果
    /// </summary>
    public void ShowSearchResults(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
        {
            AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc.Get(L.NoTorrentsFound))}[/]");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableIndex))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableTitle))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableUncensored))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableSubtitle))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableHD))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableSize))}[/]");

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
            AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc.Get(L.NoSearchResults))}[/]");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableIndex))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableJavId))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableTitle))}[/]");

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
    /// 显示下载列表
    /// </summary>
    public void ShowDownloadList(List<TorrentInfo> torrents)
    {
        if (torrents.Count == 0)
        {
            AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.NoDownloads))}[/]");
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableIndex))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableTitle))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableProgress))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableState))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableSize))}[/]");

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
        AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc.Get(L.Error))}: {Markup.Escape(message)}[/]");
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
        AnsiConsole.MarkupLine($"[blue]{Markup.Escape(message)}[/]");
        await action();
    }

    /// <summary>
    /// 显示本地文件信息
    /// </summary>
    public void ShowLocalFileInfo(List<LocalFileInfo> files)
    {
        if (files.Count == 0)
        {
            ShowInfo(_loc.Get(L.NoLocalFiles));
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableIndex))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableFileName))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TablePath))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableSize))}[/]");

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
        AnsiConsole.Write(new Rule($"[yellow]{Markup.Escape(_loc.Get(L.HealthCheckTitle))}[/]").RuleStyle("grey"));
        AnsiConsole.WriteLine();

        if (results.Count == 0)
        {
            AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.HealthCheckNoCheckers))}[/]");
            AnsiConsole.WriteLine();
            return;
        }

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableService))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableStatus))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableMessage))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableUrl))}[/]");

        foreach (var result in results)
        {
            var status = result.IsHealthy 
                ? $"[green]✓ {Markup.Escape(_loc.Get(L.StatusHealthy))}[/]" 
                : $"[red]✗ {Markup.Escape(_loc.Get(L.StatusUnhealthy))}[/]";
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
            AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc.GetFormat(L.UnhealthyWarning, unhealthyCount))}[/]");
            ShowDependencySetupHints(results.Where(r => !r.IsHealthy).ToList());
            AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.ConfigHint))}[/]");
            AnsiConsole.WriteLine();
        }
        else
        {
            AnsiConsole.MarkupLine($"[green]{Markup.Escape(_loc.Get(L.AllServicesHealthy))}[/]");
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
                AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.EverythingSetupHint))}[/]");
                AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.EverythingDownload))}");
                AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.EverythingPlugin))}");
                AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.EverythingConfig))}");
                AnsiConsole.WriteLine();
            }
            else if (r.ServiceName.Contains("qBittorrent", StringComparison.OrdinalIgnoreCase))
            {
                AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.QBittorrentSetupHint))}[/]");
                AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.QBittorrentDownload))}");
                AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.QBittorrentEnhanced))}");
                AnsiConsole.MarkupLine($"  • {Markup.Escape(_loc.Get(L.QBittorrentConfig))}");
                AnsiConsole.WriteLine();
            }
        }
    }

    /// <summary>
    /// 显示本地缓存统计信息
    /// </summary>
    public void ShowCacheStatistics(CacheStatistics stats)
    {
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Rule($"[yellow]{Markup.Escape(_loc.Get(L.CacheStatsTitle))}[/]").RuleStyle("grey"));
        AnsiConsole.WriteLine();

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableItem))}[/]");
        table.AddColumn($"[yellow]{Markup.Escape(_loc.Get(L.TableValue))}[/]");

        table.AddRow(_loc.Get(L.CacheJavCount), stats.TotalJavCount.ToString("N0"));
        table.AddRow(_loc.Get(L.CacheTorrentCount), stats.TotalTorrentCount.ToString("N0"));
        table.AddRow(_loc.Get(L.CacheDbSize), FormatSize(stats.DatabaseSizeBytes));
        table.AddRow(_loc.Get(L.CacheLastUpdated), stats.LastUpdatedAt?.ToString("yyyy-MM-dd HH:mm:ss") ?? "-");

        AnsiConsole.Write(table);
        AnsiConsole.WriteLine();
    }

    /// <summary>
    /// 显示 JAV 详细信息
    /// </summary>
    public void ShowJavDetails(JavSearchResult result)
    {
        if (result == null)
            return;

        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Rule($"[yellow]{Markup.Escape(result.JavId)}[/]").RuleStyle("grey"));
        AnsiConsole.WriteLine();

        var table = new Table();
        table.Border(TableBorder.Rounded);
        table.HideHeaders();
        table.AddColumn(_loc.Get(L.TableItem));
        table.AddColumn(_loc.Get(L.TableValue));

        table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailJavId))}[/]", Markup.Escape(result.JavId));
        table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailTitle))}[/]", Markup.Escape(result.Title));
        
        if (result.ReleaseDate != DateTime.MinValue)
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailReleaseDate))}[/]", result.ReleaseDate.ToString("yyyy-MM-dd"));
        
        if (result.Duration > 0)
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailDuration))}[/]", _loc.GetFormat(L.DurationMinutes, result.Duration));
        
        if (!string.IsNullOrWhiteSpace(result.Director))
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailDirector))}[/]", Markup.Escape(result.Director));
        
        if (!string.IsNullOrWhiteSpace(result.Maker))
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailMaker))}[/]", Markup.Escape(result.Maker));
        
        if (!string.IsNullOrWhiteSpace(result.Publisher))
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailPublisher))}[/]", Markup.Escape(result.Publisher));
        
        if (!string.IsNullOrWhiteSpace(result.Series))
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailSeries))}[/]", Markup.Escape(result.Series));
        
        if (result.Actors.Count > 0)
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailActors))}[/]", Markup.Escape(string.Join(", ", result.Actors)));
        
        if (result.Categories.Count > 0)
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailCategories))}[/]", Markup.Escape(string.Join(", ", result.Categories)));

        table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailDataSource))}[/]", result.DataSource);
        
        if (result.CachedAt.HasValue)
            table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailCachedAt))}[/]", result.CachedAt.Value.ToString("yyyy-MM-dd HH:mm:ss"));

        table.AddRow($"[yellow]{Markup.Escape(_loc.Get(L.DetailTorrentCount))}[/]", result.Torrents.Count.ToString());

        AnsiConsole.Write(table);
        AnsiConsole.WriteLine();
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

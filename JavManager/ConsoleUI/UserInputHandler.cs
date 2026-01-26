using JavManager.Core.Models;
using JavManager.Localization;
using Spectre.Console;

namespace JavManager.ConsoleUI;

/// <summary>
/// User input handler
/// </summary>
public class UserInputHandler
{
    private readonly LocalizationService _loc;

    public UserInputHandler(LocalizationService localizationService)
    {
        _loc = localizationService;
    }

    public void WritePrompt()
    {
        AnsiConsole.Markup($"[cyan]{Markup.Escape(_loc.Get(L.PromptInput))}[/]");
    }

    /// <summary>
    /// 获取用户输入（命令或番号）
    /// </summary>
    public string GetJavId()
    {
        WritePrompt();
        var input = Console.ReadLine()?.Trim() ?? string.Empty;

        // 退出命令
        if (input.Equals("q", StringComparison.OrdinalIgnoreCase) ||
            input.Equals("quit", StringComparison.OrdinalIgnoreCase) ||
            input.Equals("exit", StringComparison.OrdinalIgnoreCase))
        {
            return "quit";
        }

        return input;
    }

    /// <summary>
    /// Handle user selection when local file exists
    /// </summary>
    /// <param name="localFiles">Local file list</param>
    /// <returns>User selection result</returns>
    public UserSelectionResult GetLocalFileSelection(List<LocalFileInfo> localFiles)
    {
        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine($"[yellow]{Markup.Escape(_loc.Get(L.LocalFileExists))}[/]");
        AnsiConsole.MarkupLine($"  [green]{Markup.Escape(_loc.Get(L.LocalFileOption1Skip))}[/]");
        AnsiConsole.MarkupLine($"  [blue]{Markup.Escape(_loc.Get(L.LocalFileOption2Force))}[/]");
        AnsiConsole.MarkupLine($"  [grey]{Markup.Escape(_loc.Get(L.LocalFileOption3Details))}[/]");
        AnsiConsole.Markup($"[cyan]{Markup.Escape(_loc.Get(L.PromptLocalFileSelection))}[/]");

        var input = Console.ReadLine()?.Trim() ?? string.Empty;

        return input switch
        {
            "1" => new UserSelectionResult { SelectedIndex = 1, IsCancelled = true },
            "2" => new UserSelectionResult { SelectedIndex = 2, ForceDownload = true },
            "3" => new UserSelectionResult { SelectedIndex = 3 },
            _ => new UserSelectionResult { IsCancelled = true }
        };
    }

    /// <summary>
    /// Confirm torrent selection
    /// </summary>
    public int? GetTorrentIndexSelection(int maxIndex)
    {
        if (maxIndex <= 0)
            return null;

        while (true)
        {
            AnsiConsole.Markup($"[cyan]{Markup.Escape(_loc.GetFormat(L.PromptTorrentSelection, maxIndex))}[/]");
            var input = Console.ReadLine()?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(input))
                return 1;

            if (input == "0")
                return null;

            if (!int.TryParse(input, out var index) || index < 1 || index > maxIndex)
            {
                AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc.GetFormat(L.PromptInvalidInputRange, maxIndex))}[/]");
                continue;
            }

            return index;
        }
    }

    /// <summary>
    /// Select search result index (JavDB search results)
    /// </summary>
    public int? GetSearchResultIndexSelection(int maxIndex)
    {
        if (maxIndex <= 0)
            return null;

        while (true)
        {
            AnsiConsole.Markup($"[cyan]{Markup.Escape(_loc.GetFormat(L.PromptSearchResultSelection, maxIndex))}[/]");
            var input = Console.ReadLine()?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(input))
                return 1;

            if (input == "0")
                return null;

            if (!int.TryParse(input, out var index) || index < 1 || index > maxIndex)
            {
                AnsiConsole.MarkupLine($"[red]{Markup.Escape(_loc.GetFormat(L.PromptInvalidInputRange, maxIndex))}[/]");
                continue;
            }

            return index;
        }
    }

    /// <summary>
    /// Wait for user to press any key to continue
    /// </summary>
    public void Pause()
    {
        AnsiConsole.WriteLine();
        AnsiConsole.Markup($"[grey]{Markup.Escape(_loc.Get(L.PressAnyKey))}[/]");
        Console.ReadKey(true);
    }
}

using JavManager.Core.Models;

namespace JavManager.ConsoleUI;

/// <summary>
/// 用户输入处理器
/// </summary>
public class UserInputHandler
{
    /// <summary>
    /// 获取用户输入（命令或番号）
    /// </summary>
    public string GetJavId()
    {
        Console.Write("请输入命令或番号 (输入 h 查看命令, 输入 q 退出): ");
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
    /// 处理本地文件存在时的用户选择
    /// </summary>
    /// <param name="localFiles">本地文件列表</param>
    /// <returns>用户选择结果</returns>
    public UserSelectionResult GetLocalFileSelection(List<LocalFileInfo> localFiles)
    {
        Console.WriteLine();
        Console.WriteLine("本地文件已存在，请选择操作：");
        Console.WriteLine("  1. 跳过下载");
        Console.WriteLine("  2. 强制重新下载");
        Console.WriteLine("  3. 显示文件详情");
        Console.Write("请输入选项 (1-3): ");

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
    /// 确认操作
    /// </summary>
    public int? GetTorrentIndexSelection(int maxIndex)
    {
        if (maxIndex <= 0)
            return null;

        while (true)
        {
            Console.Write($"请选择下载第几个？ (1-{maxIndex}, 回车默认选择第一个, 0 取消): ");
            var input = Console.ReadLine()?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(input))
                return 1;

            if (input == "0")
                return null;

            if (!int.TryParse(input, out var index) || index < 1 || index > maxIndex)
            {
                Console.WriteLine($"输入无效，请输入 1-{maxIndex}，或直接回车默认选择第一个。");
                continue;
            }

            return index;
        }
    }

    /// <summary>
    /// 选择搜索结果序号（JavDB 搜索结果）
    /// </summary>
    public int? GetSearchResultIndexSelection(int maxIndex)
    {
        if (maxIndex <= 0)
            return null;

        while (true)
        {
            Console.Write($"请选择搜索结果第几个？ (1-{maxIndex}, 回车默认选择第一个, 0 取消): ");
            var input = Console.ReadLine()?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(input))
                return 1;

            if (input == "0")
                return null;

            if (!int.TryParse(input, out var index) || index < 1 || index > maxIndex)
            {
                Console.WriteLine($"输入无效，请输入 1-{maxIndex} 或直接回车默认选择第一个。");
                continue;
            }

            return index;
        }
    }

    /// <summary>
    /// 等待用户按任意键继续
    /// </summary>
    public void Pause()
    {
        Console.WriteLine();
        Console.Write("按任意键继续...");
        Console.ReadKey(true);
    }
}

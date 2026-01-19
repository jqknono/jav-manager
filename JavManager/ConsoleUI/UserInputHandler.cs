using JavManager.Core.Models;

namespace JavManager.ConsoleUI;

/// <summary>
/// 用户输入处理器
/// </summary>
public class UserInputHandler
{
    /// <summary>
    /// 获取用户输入的番号
    /// </summary>
    public string GetJavId()
    {
        Console.Write("请输入番号 (如 XXX-123, 输入 'quit' 退出): ");
        var input = Console.ReadLine()?.Trim() ?? string.Empty;

        // 退出命令
        if (input.Equals("quit", StringComparison.OrdinalIgnoreCase) ||
            input.Equals("exit", StringComparison.OrdinalIgnoreCase))
        {
            return "quit";
        }

        // 验证输入
        if (string.IsNullOrWhiteSpace(input))
        {
            Console.WriteLine("输入不能为空。");
            return GetJavId();
        }

        // 基本格式验证
        if (!System.Text.RegularExpressions.Regex.IsMatch(input, @"^[A-Z0-9]+-\d+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        {
            Console.WriteLine("番号格式不正确，应为类似 XXX-123 的格式。");
            return GetJavId();
        }

        return input.ToUpper();
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
    public bool Confirm(string message)
    {
        Console.Write($"{message} (y/n): ");
        var input = Console.ReadLine()?.Trim().ToLower();
        return input == "y" || input == "yes";
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

using System.Diagnostics;
using System.Text;

namespace JavManager.Utils;

/// <summary>
/// 使用 curl 进程作为 HTTP 客户端，绕过 .NET TLS 指纹检测
/// </summary>
public class CurlHttpClient : IDisposable
{
    private readonly Dictionary<string, string> _defaultHeaders;
    private readonly Dictionary<string, string> _cookies;
    private readonly int _timeoutSeconds;

    public CurlHttpClient(int timeoutSeconds = 30)
    {
        _timeoutSeconds = timeoutSeconds;
        _defaultHeaders = new Dictionary<string, string>();
        _cookies = new Dictionary<string, string>();
    }

    /// <summary>
    /// 设置默认请求头
    /// </summary>
    public void SetDefaultHeader(string name, string value)
    {
        _defaultHeaders[name] = value;
    }

    /// <summary>
    /// 设置 Cookie
    /// </summary>
    public void SetCookie(string name, string value)
    {
        _cookies[name] = value;
    }

    /// <summary>
    /// 发送 GET 请求
    /// </summary>
    public async Task<CurlResponse> GetAsync(string url, string? referer = null)
    {
        var args = BuildCurlArguments(url, referer);
        return await ExecuteCurlAsync(args);
    }

    /// <summary>
    /// 发送 POST 请求 (表单数据)
    /// </summary>
    public async Task<CurlResponse> PostFormAsync(string url, Dictionary<string, string> formData, string? referer = null)
    {
        var args = BuildCurlArguments(url, referer);
        
        // 添加 POST 数据
        args.Add("-X");
        args.Add("POST");
        
        foreach (var kvp in formData)
        {
            args.Add("-d");
            args.Add($"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}");
        }
        
        return await ExecuteCurlAsync(args);
    }

    /// <summary>
    /// 构建 curl 命令参数
    /// </summary>
    private List<string> BuildCurlArguments(string url, string? referer)
    {
        var args = new List<string>
        {
            "-s",                    // 静默模式
            "-L",                    // 跟随重定向
            "-w", "\n%{http_code}",  // 输出状态码（使用实际换行符）
            "--max-time", _timeoutSeconds.ToString(),
            "--compressed",          // 自动解压
        };

        // 添加请求头
        foreach (var header in _defaultHeaders)
        {
            args.Add("-H");
            args.Add($"{header.Key}: {header.Value}");
        }

        // 添加 Cookie
        if (_cookies.Count > 0)
        {
            var cookieStr = string.Join("; ", _cookies.Select(c => $"{c.Key}={c.Value}"));
            args.Add("-H");
            args.Add($"Cookie: {cookieStr}");
        }

        // 添加 Referer
        if (!string.IsNullOrEmpty(referer))
        {
            args.Add("-H");
            args.Add($"Referer: {referer}");
        }

        // 添加 URL
        args.Add(url);

        return args;
    }

    /// <summary>
    /// 执行 curl 命令
    /// </summary>
    private async Task<CurlResponse> ExecuteCurlAsync(List<string> args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "curl",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8
        };

        foreach (var arg in args)
        {
            psi.ArgumentList.Add(arg);
        }

        using var process = new Process { StartInfo = psi };
        var outputBuilder = new StringBuilder();
        var errorBuilder = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null)
                outputBuilder.AppendLine(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null)
                errorBuilder.AppendLine(e.Data);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();

        var output = outputBuilder.ToString();
        var error = errorBuilder.ToString();

        // 解析响应：最后一行是状态码
        var lines = output.TrimEnd().Split('\n');
        var statusCode = 0;
        var body = output;

        if (lines.Length > 0 && int.TryParse(lines[^1].Trim(), out var code))
        {
            statusCode = code;
            // 移除最后一行状态码
            body = string.Join('\n', lines.Take(lines.Length - 1));
        }

        var response = new CurlResponse
        {
            StatusCode = statusCode,
            Body = body,
            Error = error,
            ExitCode = process.ExitCode
        };

        // 调试输出
        Console.WriteLine($"[DEBUG] curl exit={process.ExitCode}, status={statusCode}, bodyLen={body.Length}, error={error}");

        return response;
    }

    public void Dispose()
    {
        // 无需清理
    }
}

/// <summary>
/// curl 响应
/// </summary>
public class CurlResponse
{
    public int StatusCode { get; set; }
    public string Body { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public int ExitCode { get; set; }

    public bool IsSuccessStatusCode => StatusCode >= 200 && StatusCode < 300;

    public void EnsureSuccessStatusCode()
    {
        if (!IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Response status code does not indicate success: {StatusCode}");
        }
    }
}

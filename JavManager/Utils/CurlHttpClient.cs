using System.Diagnostics;
using System.Text;
using Spectre.Console;

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
    public async Task<CurlResponse> GetAsync(string url, string? referer = null, int? timeoutSeconds = null)
    {
        var args = BuildCurlArguments(url, referer, timeoutSeconds);
        return await ExecuteCurlAsync(args);
    }

    /// <summary>
    /// 发送 POST 请求 (表单数据)
    /// </summary>
    public async Task<CurlResponse> PostFormAsync(string url, Dictionary<string, string> formData, string? referer = null, int? timeoutSeconds = null)
    {
        var args = BuildCurlArguments(url, referer, timeoutSeconds);
        
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
    private List<string> BuildCurlArguments(string url, string? referer, int? timeoutSeconds)
    {
        var effectiveTimeoutSeconds = timeoutSeconds ?? _timeoutSeconds;

        var args = new List<string>
        {
            "-s",                    // 静默模式
            "-L",                    // 跟随重定向
            "-w", "\n%{http_code}",  // 输出状态码（使用实际换行符）
            "--max-time", effectiveTimeoutSeconds.ToString(),
            "--compressed",          // 自动解压
            
            // TLS 指纹伪造：模拟 Chrome 浏览器
            "--http2",               // 使用 HTTP/2（Chrome 默认）
            "--tlsv1.2",             // 最低 TLS 1.2
            "--tls-max", "1.3",      // 最高 TLS 1.3
            
            // Chrome 风格的密码套件顺序
            "--ciphers", "TLS_AES_128_GCM_SHA256,TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256,ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256,ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-ECDSA-CHACHA20-POLY1305,ECDHE-RSA-CHACHA20-POLY1305",
        };

        // 添加请求头（按 Chrome 顺序）
        // 注意：头部顺序对某些 WAF 检测很重要
        var orderedHeaders = new List<(string Key, string Value)>();
        
        // 优先添加关键头部（Chrome 顺序）
        if (_defaultHeaders.TryGetValue("Host", out var host))
            orderedHeaders.Add(("Host", host));
        if (_defaultHeaders.TryGetValue("Connection", out var conn))
            orderedHeaders.Add(("Connection", conn));
        if (_defaultHeaders.TryGetValue("Cache-Control", out var cache))
            orderedHeaders.Add(("Cache-Control", cache));
        if (_defaultHeaders.TryGetValue("Upgrade-Insecure-Requests", out var upgrade))
            orderedHeaders.Add(("Upgrade-Insecure-Requests", upgrade));
        if (_defaultHeaders.TryGetValue("User-Agent", out var ua))
            orderedHeaders.Add(("User-Agent", ua));
        if (_defaultHeaders.TryGetValue("Accept", out var accept))
            orderedHeaders.Add(("Accept", accept));
        
        // Sec-* 头部
        foreach (var header in _defaultHeaders.Where(h => h.Key.StartsWith("Sec-", StringComparison.OrdinalIgnoreCase)))
        {
            if (!orderedHeaders.Any(h => h.Key.Equals(header.Key, StringComparison.OrdinalIgnoreCase)))
                orderedHeaders.Add((header.Key, header.Value));
        }
        
        if (_defaultHeaders.TryGetValue("Accept-Language", out var lang))
            orderedHeaders.Add(("Accept-Language", lang));
        if (_defaultHeaders.TryGetValue("Accept-Encoding", out var enc))
            orderedHeaders.Add(("Accept-Encoding", enc));
        
        // 添加剩余头部
        foreach (var header in _defaultHeaders)
        {
            if (!orderedHeaders.Any(h => h.Key.Equals(header.Key, StringComparison.OrdinalIgnoreCase)))
                orderedHeaders.Add((header.Key, header.Value));
        }
        
        foreach (var header in orderedHeaders)
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

        // Debug output
        AnsiConsole.MarkupLine($"[grey][[DEBUG]] curl exit={process.ExitCode}, status={statusCode}, bodyLen={body.Length}, error={Markup.Escape(error)}[/]");

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

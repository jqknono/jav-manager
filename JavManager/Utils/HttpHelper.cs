using System.Net.Http.Headers;
using System.Net;
using System.Text;

namespace JavManager.Utils;

/// <summary>
/// HTTP 请求辅助类
/// </summary>
public class HttpHelper : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly Dictionary<string, string> _defaultHeaders;
    private readonly CookieContainer _cookieContainer;

    public HttpHelper(TimeSpan? timeout = null)
    {
        _cookieContainer = new CookieContainer();
        var handler = new HttpClientHandler
        {
            UseCookies = true,
            CookieContainer = _cookieContainer
        };

        _httpClient = new HttpClient(handler)
        {
            Timeout = timeout ?? TimeSpan.FromSeconds(30)
        };
        _defaultHeaders = new Dictionary<string, string>();
    }

    public HttpHelper(HttpClient httpClient)
    {
        _cookieContainer = new CookieContainer();
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _defaultHeaders = new Dictionary<string, string>();
    }

    /// <summary>
    /// 设置默认请求头
    /// </summary>
    public void SetDefaultHeader(string name, string value)
    {
        _defaultHeaders[name] = value;
    }

    /// <summary>
    /// 设置 Basic Auth
    /// </summary>
    public void SetBasicAuth(string userName, string password)
    {
        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{userName}:{password}"));
        SetDefaultHeader("Authorization", $"Basic {credentials}");
    }

    /// <summary>
    /// 设置 Cookie
    /// </summary>
    public void SetCookie(string name, string value, string domain = "")
    {
        var cookieValue = string.IsNullOrEmpty(domain) ? $"{name}={value}" : $"{name}={value}; Domain={domain}";
        SetDefaultHeader("Cookie", cookieValue);
    }

    /// <summary>
    /// 发送 GET 请求
    /// </summary>
    public async Task<string> GetAsync(string url, Dictionary<string, string>? headers = null, TimeSpan? timeout = null, CancellationToken cancellationToken = default)
    {
        using var request = CreateRequest(HttpMethod.Get, url, headers);
        return await SendRequestAsync(request, timeout, cancellationToken);
    }

    /// <summary>
    /// 发送 POST 请求 (表单数据)
    /// </summary>
    public async Task<string> PostAsync(string url, Dictionary<string, string> formData, Dictionary<string, string>? headers = null, TimeSpan? timeout = null, CancellationToken cancellationToken = default)
    {
        var content = new FormUrlEncodedContent(formData);
        using var request = CreateRequest(HttpMethod.Post, url, headers, content);
        return await SendRequestAsync(request, timeout, cancellationToken);
    }

    /// <summary>
    /// ?? POST ?? (multipart/form-data)
    /// </summary>
    public async Task<string> PostMultipartAsync(string url, Dictionary<string, string> formData, Dictionary<string, string>? headers = null, TimeSpan? timeout = null, CancellationToken cancellationToken = default)
    {
        var content = new MultipartFormDataContent();
        foreach (var (key, value) in formData)
        {
            content.Add(new StringContent(value ?? string.Empty, Encoding.UTF8), key);
        }

        using var request = CreateRequest(HttpMethod.Post, url, headers, content);
        return await SendRequestAsync(request, timeout, cancellationToken);
    }

    /// <summary>
    /// 发送 POST 请求 (JSON)
    /// </summary>
    public async Task<string> PostJsonAsync(string url, string json, Dictionary<string, string>? headers = null, TimeSpan? timeout = null, CancellationToken cancellationToken = default)
    {
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var request = CreateRequest(HttpMethod.Post, url, headers, content);
        return await SendRequestAsync(request, timeout, cancellationToken);
    }

    /// <summary>
    /// 创建 HttpRequestMessage
    /// </summary>
    private HttpRequestMessage CreateRequest(HttpMethod method, string url, Dictionary<string, string>? headers, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, url);

        // 添加默认请求头
        foreach (var header in _defaultHeaders)
        {
            request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        // 添加自定义请求头
        if (headers != null)
        {
            foreach (var header in headers)
            {
                request.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        // 设置请求体
        if (content != null)
        {
            request.Content = content;
        }

        return request;
    }

    /// <summary>
    /// 发送请求并获取响应
    /// </summary>
    private async Task<string> SendRequestAsync(HttpRequestMessage request, TimeSpan? timeout, CancellationToken cancellationToken)
    {
        try
        {
            using var cts = timeout.HasValue
                ? CancellationTokenSource.CreateLinkedTokenSource(cancellationToken)
                : null;

            if (timeout.HasValue)
            {
                cts!.CancelAfter(timeout.Value);
                cancellationToken = cts.Token;
            }

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"HTTP request failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 下载文件
    /// </summary>
    public async Task DownloadFileAsync(string url, string destinationPath)
    {
        try
        {
            var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            await using var fileStream = File.Create(destinationPath);
            await using var contentStream = await response.Content.ReadAsStreamAsync();

            await contentStream.CopyToAsync(fileStream);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"File download failed: {ex.Message}", ex);
        }
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
    }
}

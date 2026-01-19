using System.Text;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace JavManager.DataProviders.Everything;

/// <summary>
/// Everything HTTP API 客户端
/// </summary>
public class EverythingHttpClient : IEverythingSearchProvider, IHealthChecker
{
    private readonly EverythingConfig _config;
    private readonly HttpHelper _httpHelper;
    private readonly string _baseUrl;

    public EverythingHttpClient(EverythingConfig config)
    {
        _config = config;
        _httpHelper = new HttpHelper(TimeSpan.FromSeconds(10));

        // 构建基础 URL
        var port = _config.Port.HasValue ? $":{_config.Port}" : "";
        _baseUrl = $"{_config.BaseUrl.TrimEnd('/')}{port}";

        // 设置认证
        if (_config.UseAuthentication)
        {
            _httpHelper.SetBasicAuth(_config.UserName!, _config.Password!);
        }
    }

    /// <summary>
    /// 搜索本地文件
    /// </summary>
    public async Task<List<LocalFileInfo>> SearchAsync(string searchTerm)
    {
        try
        {
            // 构建查询 URL
            var query = Uri.EscapeDataString(searchTerm);
            var url = $"{_baseUrl}/?s={query}&json=1&path_column=1&size_column=1&date_modified_column=1";

            // 发送请求
            var response = await _httpHelper.GetAsync(url);

            // 解析 JSON 响应
            var results = ParseSearchResponse(response);

            return results;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Everything search failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 检查文件是否存在
    /// </summary>
    public async Task<bool> FileExistsAsync(string javId)
    {
        var results = await SearchAsync(javId);
        return results.Count > 0;
    }

    /// <summary>
    /// 解析 Everything 搜索响应
    /// </summary>
    private List<LocalFileInfo> ParseSearchResponse(string jsonResponse)
    {
        var results = new List<LocalFileInfo>();

        // Everything HTTP API 返回格式: { "totalResults": N, "results": [...] }
        var json = JObject.Parse(jsonResponse);
        var jsonArray = json["results"] as JArray;

        if (jsonArray == null)
            return results;

        foreach (var item in jsonArray)
        {
            var name = item["name"]?.ToString() ?? string.Empty;
            var path = item["path"]?.ToString() ?? string.Empty;
            var size = item["size"]?.ToObject<long>() ?? 0;
            var modifiedDateTicks = item["date_modified"]?.ToObject<long>() ?? 0;

            // 判断文件类型
            var fileType = DetermineFileType(name);

            results.Add(new LocalFileInfo
            {
                FileName = name,
                FullPath = string.IsNullOrEmpty(path) ? name : System.IO.Path.Combine(path, name),
                Size = size,
                ModifiedDate = modifiedDateTicks > 0 
                    ? DateTimeOffset.FromUnixTimeSeconds(modifiedDateTicks).DateTime 
                    : DateTime.MinValue,
                FileType = fileType
            });
        }

        return results;
    }

    /// <summary>
    /// 判断文件类型
    /// </summary>
    private FileType DetermineFileType(string fileName)
    {
        var extension = System.IO.Path.GetExtension(fileName).ToLower();

        // 视频文件
        var videoExtensions = new[] { ".mp4", ".mkv", ".avi", ".wmv", ".mov", ".flv", ".webm", ".m4v" };
        if (videoExtensions.Contains(extension))
        {
            return FileType.Video;
        }

        // 种子文件
        if (extension == ".torrent")
        {
            return FileType.Torrent;
        }

        // 默认为文件夹（Everything 可能返回无扩展名的项）
        return FileType.Folder;
    }

    public void Dispose()
    {
        _httpHelper?.Dispose();
    }

    // ========== IHealthChecker 实现 ==========

    /// <summary>
    /// 服务名称
    /// </summary>
    string IHealthChecker.ServiceName => "Everything (本地搜索)";

    /// <summary>
    /// 检查服务健康状态
    /// </summary>
    public async Task<HealthCheckResult> CheckHealthAsync()
    {
        try
        {
            // 发送一个简单查询来测试连接
            var url = $"{_baseUrl}/?s=test&json=1&count=1";
            var response = await _httpHelper.GetAsync(url);

            // 尝试解析响应
            var json = JObject.Parse(response);
            if (json["results"] == null)
                throw new InvalidOperationException("Invalid response format");

            return new HealthCheckResult
            {
                ServiceName = ((IHealthChecker)this).ServiceName,
                IsHealthy = true,
                Message = "服务正常",
                Url = _baseUrl
            };
        }
        catch (Exception ex)
        {
            return new HealthCheckResult
            {
                ServiceName = ((IHealthChecker)this).ServiceName,
                IsHealthy = false,
                Message = $"连接失败: {ex.Message}",
                Url = _baseUrl
            };
        }
    }
}

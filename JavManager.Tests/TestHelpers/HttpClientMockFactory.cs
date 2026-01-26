using Moq;
using Moq.Protected;
using System.Net;

namespace JavManager.Tests.TestHelpers;

/// <summary>
/// HTTP 客户端 Mock 工厂，用于简化测试中的 HTTP 请求模拟
/// </summary>
public static class HttpClientMockFactory
{
    /// <summary>
    /// 创建一个带有自定义处理程序的 HttpClient
    /// </summary>
    /// <param name="handler">处理 HTTP 请求的函数</param>
    /// <returns>配置好的 HttpClient 实例</returns>
    public static HttpClient Create(Func<HttpRequestMessage, HttpResponseMessage> handler)
    {
        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync((HttpRequestMessage request, CancellationToken _) => handler(request));

        return new HttpClient(mockHandler.Object);
    }

    /// <summary>
    /// 创建一个返回指定内容的 HttpClient
    /// </summary>
    /// <param name="content">响应内容</param>
    /// <param name="statusCode">HTTP 状态码（默认 200 OK）</param>
    /// <returns>配置好的 HttpClient 实例</returns>
    public static HttpClient CreateReturningContent(string content, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        return Create(_ => new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(content)
        });
    }

    /// <summary>
    /// 创建一个返回指定 JSON 内容的 HttpClient
    /// </summary>
    /// <param name="json">JSON 响应内容</param>
    /// <param name="statusCode">HTTP 状态码（默认 200 OK）</param>
    /// <returns>配置好的 HttpClient 实例</returns>
    public static HttpClient CreateReturningJson(string json, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        return Create(_ => new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        });
    }

    /// <summary>
    /// 创建一个返回错误状态的 HttpClient
    /// </summary>
    /// <param name="statusCode">HTTP 错误状态码</param>
    /// <returns>配置好的 HttpClient 实例</returns>
    public static HttpClient CreateReturningError(HttpStatusCode statusCode)
    {
        return Create(_ => new HttpResponseMessage(statusCode));
    }
}

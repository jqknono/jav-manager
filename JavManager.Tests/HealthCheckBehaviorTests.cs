using System.Net;
using System.Net.Http;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.Core.Interfaces;
using JavManager.DataProviders.Everything;
using JavManager.DataProviders.QBittorrent;
using JavManager.Localization;
using JavManager.Services;
using JavManager.Utils;
using Xunit;

namespace JavManager.Tests;

public class HealthCheckBehaviorTests
{
    [Fact]
    public async Task EverythingHealthCheck_Retries_UpTo_Three_Times_On_Http_Failure()
    {
        var handler = new CountingHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent("nope")
        });
        using var httpClient = new HttpClient(handler);
        using var httpHelper = new HttpHelper(httpClient);

        var config = new EverythingConfig { BaseUrl = "http://localhost:1" };
        var client = new EverythingHttpClient(config, new LocalizationService(), httpHelper);

        var result = await client.CheckHealthAsync();

        Assert.False(result.IsHealthy);
        Assert.Equal(3, handler.CallCount);
    }

    [Fact]
    public async Task QBittorrentHealthCheck_Retries_UpTo_Three_Times_On_Http_Failure()
    {
        var handler = new CountingHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent("nope")
        });
        using var httpClient = new HttpClient(handler);
        using var httpHelper = new HttpHelper(httpClient);

        var config = new QBittorrentConfig { BaseUrl = "http://localhost:1", UserName = "admin", Password = "x" };
        var client = new QBittorrentApiClient(config, new LocalizationService(), httpHelper);

        var result = await client.CheckHealthAsync();

        Assert.False(result.IsHealthy);
        Assert.Equal(3, handler.CallCount);
    }

    [Fact]
    public async Task HealthCheckService_Runs_Checks_Concurrently()
    {
        var checker1 = new BlockingHealthChecker("svc-1");
        var checker2 = new BlockingHealthChecker("svc-2");
        var service = new HealthCheckService(new IHealthChecker[] { checker1, checker2 });

        var task = service.CheckAllAsync();

        await checker1.Started.Task.WaitAsync(TimeSpan.FromSeconds(1));
        await checker2.Started.Task.WaitAsync(TimeSpan.FromSeconds(1));

        checker1.Continue.TrySetResult();
        checker2.Continue.TrySetResult();

        var results = await task;
        Assert.Equal(2, results.Count);
    }

    private sealed class CountingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public CountingHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(_handler(request));
        }
    }

    private sealed class BlockingHealthChecker : IHealthChecker
    {
        public BlockingHealthChecker(string name)
        {
            ServiceName = name;
        }

        public string ServiceName { get; }

        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Continue { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public async Task<HealthCheckResult> CheckHealthAsync()
        {
            Started.TrySetResult();
            await Continue.Task;
            return new HealthCheckResult { ServiceName = ServiceName, IsHealthy = true, Message = "ok" };
        }
    }
}

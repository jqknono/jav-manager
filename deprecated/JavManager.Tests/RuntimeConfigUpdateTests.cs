using System.Net;
using System.Net.Http;
using System.Text;
using System.Linq;
using JavManager.Core.Configuration.ConfigSections;
using JavManager.DataProviders.Everything;
using JavManager.DataProviders.QBittorrent;
using JavManager.Localization;
using JavManager.Utils;
using Xunit;

namespace JavManager.Tests;

public class RuntimeConfigUpdateTests
{
    [Fact]
    public void LocalizationService_SetLanguage_ChangesCulture()
    {
        var loc = new LocalizationService();
        Assert.Equal("en", loc.CurrentCulture.TwoLetterISOLanguageName);

        loc.SetLanguage("zh");
        Assert.Equal("zh", loc.CurrentCulture.TwoLetterISOLanguageName);

        loc.SetLanguage("en");
        Assert.Equal("en", loc.CurrentCulture.TwoLetterISOLanguageName);
    }

    [Fact]
    public async Task EverythingHttpClient_UsesUpdatedConfig_ForBaseUrlAndAuth()
    {
        var handler = new RecordingHandler(_ => """{"totalResults":0,"results":[]}""");
        var httpClient = new HttpClient(handler);
        var httpHelper = new HttpHelper(httpClient);

        var config = new EverythingConfig { BaseUrl = "http://a" };
        var client = new EverythingHttpClient(config, new LocalizationService(), httpHelper);

        await client.SearchAsync("test");
        Assert.StartsWith("http://a/", handler.LastRequestUri);
        Assert.Null(handler.LastAuthorization);

        config.BaseUrl = "http://b";
        config.UserName = "u";
        config.Password = "p";

        await client.SearchAsync("test");
        Assert.StartsWith("http://b/", handler.LastRequestUri);

        var expectedCredentials = Convert.ToBase64String(Encoding.ASCII.GetBytes("u:p"));
        Assert.Equal($"Basic {expectedCredentials}", handler.LastAuthorization);
    }

    [Fact]
    public async Task QBittorrentApiClient_UsesUpdatedConfig_ForBaseUrlAndCredentials()
    {
        var handler = new RecordingHandler(_ => "Ok.");
        var httpClient = new HttpClient(handler);
        var httpHelper = new HttpHelper(httpClient);

        var config = new QBittorrentConfig { BaseUrl = "http://a", UserName = "u", Password = "p" };
        var client = new QBittorrentApiClient(config, new LocalizationService(), httpHelper);

        await client.LoginAsync();
        Assert.Equal("http://a/api/v2/auth/login", handler.LastRequestUri);
        Assert.StartsWith("http://a", handler.LastReferer);
        Assert.Contains("username=u", handler.LastContent ?? string.Empty);
        Assert.Contains("password=p", handler.LastContent ?? string.Empty);

        config.BaseUrl = "http://b";
        await client.LoginAsync();
        Assert.Equal("http://b/api/v2/auth/login", handler.LastRequestUri);
        Assert.StartsWith("http://b", handler.LastReferer);

        config.UserName = "u2";
        config.Password = "p2";
        await client.LoginAsync();
        Assert.Contains("username=u2", handler.LastContent ?? string.Empty);
        Assert.Contains("password=p2", handler.LastContent ?? string.Empty);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, string> _responseBodyFactory;

        public string? LastRequestUri { get; private set; }
        public string? LastAuthorization { get; private set; }
        public string? LastReferer { get; private set; }
        public string? LastContent { get; private set; }

        public RecordingHandler(Func<HttpRequestMessage, string> responseBodyFactory)
        {
            _responseBodyFactory = responseBodyFactory;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequestUri = request.RequestUri?.ToString();

            if (request.Headers.TryGetValues("Authorization", out var authValues))
                LastAuthorization = authValues.FirstOrDefault();
            else
                LastAuthorization = null;

            if (request.Headers.TryGetValues("Referer", out var refererValues))
                LastReferer = refererValues.FirstOrDefault();
            else
                LastReferer = null;

            LastContent = request.Content == null
                ? null
                : await request.Content.ReadAsStringAsync(cancellationToken);

            var body = _responseBodyFactory(request);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "text/plain")
            };
        }
    }
}

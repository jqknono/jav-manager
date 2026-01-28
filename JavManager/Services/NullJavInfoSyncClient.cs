using JavManager.Core.Models;

namespace JavManager.Services;

public sealed class NullJavInfoSyncClient : IJavInfoSyncClient
{
    public void TrySync(JavSearchResult result)
    {
        // no-op
    }
}

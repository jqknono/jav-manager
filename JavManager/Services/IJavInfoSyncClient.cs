using JavManager.Core.Models;

namespace JavManager.Services;

public interface IJavInfoSyncClient
{
    void TrySync(JavSearchResult result);
}

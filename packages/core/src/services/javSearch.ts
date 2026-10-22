import { CacheStatistics, IJavDbDataProvider, IJavLocalCacheProvider, JavSearchResult, TorrentInfo } from "@jav-manager/domain";
import { LocalizationService } from "../localization";
import { ServiceAvailability } from "./health";
import { TorrentSelectionService } from "./torrentSelection";

export interface JavSearchProcessResult {
  javId: string;
  success: boolean;
  selectedTorrent?: TorrentInfo;
  magnetLink?: string;
  availableTorrents: TorrentInfo[];
  searchResult?: JavSearchResult;
  messages: string[];
}

export class JavSearchService {
  private javDbProvider: IJavDbDataProvider;
  private cacheProvider: IJavLocalCacheProvider | null;
  private selectionService: TorrentSelectionService;
  private serviceAvailability: ServiceAvailability;
  private loc: LocalizationService;

  constructor(
    javDbProvider: IJavDbDataProvider,
    selectionService: TorrentSelectionService,
    serviceAvailability: ServiceAvailability,
    loc: LocalizationService,
    cacheProvider?: IJavLocalCacheProvider | null
  ) {
    this.javDbProvider = javDbProvider;
    this.selectionService = selectionService;
    this.serviceAvailability = serviceAvailability;
    this.loc = loc;
    this.cacheProvider = cacheProvider ?? null;
  }

  async process(javId: string, forceRemote = false): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    let searchResult: JavSearchResult | null = null;

    if (!forceRemote && this.cacheProvider) {
      searchResult = await this.cacheProvider.get(javId);
      if (!searchResult?.torrents?.length) {
        searchResult = null;
      }
    }

    if (!searchResult) {
      if (!this.serviceAvailability.remoteSearchAvailable) {
        result.success = false;
        result.messages.push(this.loc.get("no_search_results"));
        return result;
      }

      searchResult = await this.javDbProvider.search(javId);
      if (searchResult.torrents.length === 0) {
        result.success = false;
        result.messages.push(this.loc.get("no_torrents_found"));
        return result;
      }

      if (this.cacheProvider) {
        await this.cacheProvider.save(searchResult);
      }
    }

    const selectedTorrent = this.selectionService.selectBest(searchResult.torrents);
    if (!selectedTorrent) {
      result.success = false;
      result.messages.push(this.loc.get("no_torrents_found"));
      return result;
    }

    return this.applySelectedTorrent(result, selectedTorrent);
  }

  async processSelectedTorrent(javId: string, selectedTorrent: TorrentInfo): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    return this.applySelectedTorrent(result, selectedTorrent);
  }

  async searchOnly(javId: string, forceRemote = false): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    let searchResult: JavSearchResult | null = null;

    if (!forceRemote && this.cacheProvider) {
      searchResult = await this.cacheProvider.get(javId);
    }

    if (!searchResult) {
      if (!this.serviceAvailability.remoteSearchAvailable) {
        result.success = false;
        result.messages.push(this.loc.get("no_search_results"));
        return result;
      }
      searchResult = await this.javDbProvider.search(javId);
      if (searchResult.torrents.length === 0) {
        result.success = false;
        result.messages.push(this.loc.get("no_torrents_found"));
        return result;
      }
      if (this.cacheProvider) {
        await this.cacheProvider.save(searchResult);
      }
    }

    result.availableTorrents = this.selectionService.getSortedTorrents(searchResult.torrents);
    result.searchResult = searchResult;
    result.success = result.availableTorrents.length > 0;
    return result;
  }

  async getCacheStatistics(): Promise<CacheStatistics | null> {
    if (!this.cacheProvider) {
      return null;
    }
    return this.cacheProvider.getStatistics();
  }

  private applySelectedTorrent(result: JavSearchProcessResult, selectedTorrent: TorrentInfo): JavSearchProcessResult {
    result.selectedTorrent = selectedTorrent;
    result.magnetLink = selectedTorrent.magnetLink;
    result.success = true;
    result.messages.push(this.loc.get("magnet_ready"));
    return result;
  }
}

function createProcessResult(javId: string): JavSearchProcessResult {
  return {
    javId,
    success: false,
    availableTorrents: [],
    messages: [],
  };
}

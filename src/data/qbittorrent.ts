import { QBittorrentConfig } from "../config";
import { IQBittorrentClient, IHealthChecker } from "../interfaces";
import { TorrentInfo, UncensoredMarkerType } from "../models";
import { HttpHelper } from "../utils/httpHelper";

export class QBittorrentApiClient implements IQBittorrentClient, IHealthChecker {
  private config: QBittorrentConfig;
  private http: HttpHelper;
  private sidCookie: string | null = null;
  private loginTime = 0;
  private appliedBaseUrl?: string;
  private appliedUserName?: string | null;
  private appliedPassword?: string | null;

  constructor(config: QBittorrentConfig, httpHelper?: HttpHelper) {
    this.config = config;
    this.http = httpHelper ?? new HttpHelper();
  }

  get serviceName(): string {
    return "qBittorrent";
  }

  async login(): Promise<void> {
    this.applyRuntimeConfig();
    if (!this.hasCredentials()) {
      this.sidCookie = "no-auth";
      this.loginTime = Date.now();
      return;
    }

    const form = new URLSearchParams({
      username: this.getUserName(),
      password: this.getPassword(),
    }).toString();

    const response = await this.http.request("POST", `${this.getBaseUrl()}/api/v2/auth/login`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      timeoutMs: 10000,
    });

    if (!isOkResponse(response.text)) {
      throw new Error(`qBittorrent login rejected: ${normalizeResponseText(response.text)}`);
    }

    const sid = readSidCookie(response.headers);
    this.sidCookie = sid ?? "1";
    this.loginTime = Date.now();
  }

  async addTorrent(magnetLink: string, savePath?: string, category?: string, tags?: string): Promise<boolean> {
    await this.ensureLoggedIn();

    const data = new FormData();
    data.append("urls", normalizeMagnetLink(magnetLink));
    if (savePath) data.append("savepath", savePath);
    if (category) data.append("category", category);
    if (tags) data.append("tags", tags);

    const response = await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/add`, data);
    if (!isOkResponse(response.text)) {
      throw new Error(`qBittorrent rejected torrent: ${normalizeResponseText(response.text)}`);
    }
    return true;
  }

  async addTorrentFromUrl(urls: string[], savePath?: string, category?: string, tags?: string): Promise<boolean> {
    await this.ensureLoggedIn();

    const data = new FormData();
    data.append("urls", urls.join("\n"));
    if (savePath) data.append("savepath", savePath);
    if (category) data.append("category", category);
    if (tags) data.append("tags", tags);

    const response = await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/add`, data);
    if (!isOkResponse(response.text)) {
      throw new Error(`qBittorrent rejected torrent URL(s): ${normalizeResponseText(response.text)}`);
    }
    return true;
  }

  async getTorrents(): Promise<TorrentInfo[]> {
    await this.ensureLoggedIn();
    const response = await this.request("GET", `${this.getBaseUrl()}/api/v2/torrents/info`);
    return parseTorrentList(response.text);
  }

  async pause(hashes: string[]): Promise<void> {
    await this.ensureLoggedIn();
    const hashParam = encodeURIComponent(hashes.join("|"));
    await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/stop?hashes=${hashParam}`);
  }

  async resume(hashes: string[]): Promise<void> {
    await this.ensureLoggedIn();
    const hashParam = encodeURIComponent(hashes.join("|"));
    await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/start?hashes=${hashParam}`);
  }

  async delete(hashes: string[], deleteFiles = false): Promise<void> {
    await this.ensureLoggedIn();
    const hashParam = encodeURIComponent(hashes.join("|"));
    await this.request(
      "POST",
      `${this.getBaseUrl()}/api/v2/torrents/delete?hashes=${hashParam}&deleteFiles=${deleteFiles ? "true" : "false"}`
    );
  }

  async checkHealth(): Promise<{ serviceName: string; isHealthy: boolean; message: string; url?: string }> {
    this.applyRuntimeConfig();
    const baseUrl = this.getBaseUrl();

    try {
      if (this.hasCredentials()) {
        await this.login();
      } else {
        await this.request("GET", `${baseUrl}/api/v2/app/version`);
      }
      return { serviceName: this.serviceName, isHealthy: true, message: "OK", url: baseUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { serviceName: this.serviceName, isHealthy: false, message, url: baseUrl };
    }
  }

  private getBaseUrl(): string {
    const trimmed = this.config.baseUrl.trim().replace(/\/+$/, "");
    if (!trimmed) {
      throw new Error("qBittorrent.BaseUrl is empty");
    }
    return trimmed;
  }

  private applyRuntimeConfig(): void {
    const baseUrl = this.getBaseUrl();
    const baseChanged = this.appliedBaseUrl?.toLowerCase() !== baseUrl.toLowerCase();
    const credentialsChanged =
      this.appliedUserName !== this.config.userName || this.appliedPassword !== this.config.password;

    if (baseChanged) {
      this.appliedBaseUrl = baseUrl;
      this.http.setDefaultHeader("Referer", baseUrl);
    }

    if (baseChanged || credentialsChanged) {
      this.appliedUserName = this.config.userName;
      this.appliedPassword = this.config.password;
      this.sidCookie = null;
    }
  }

  private hasCredentials(): boolean {
    return Boolean(this.config.userName || this.config.password);
  }

  private getUserName(): string {
    return this.config.userName ?? "";
  }

  private getPassword(): string {
    return this.config.password ?? "";
  }

  private async ensureLoggedIn(): Promise<void> {
    this.applyRuntimeConfig();
    if (!this.hasCredentials()) {
      this.sidCookie ??= "no-auth";
      this.loginTime = Date.now();
      return;
    }
    const thirtyMinutes = 30 * 60 * 1000;
    if (!this.sidCookie || Date.now() - this.loginTime > thirtyMinutes) {
      await this.login();
    }
  }

  private async request(method: string, url: string, body?: BodyInit): Promise<{ text: string; headers: Headers }> {
    const headers: Record<string, string> = {};
    if (this.sidCookie && this.sidCookie !== "no-auth") {
      headers.Cookie = `SID=${this.sidCookie}`;
    }

    const response = await this.http.request(method, url, { headers, body });
    return { text: response.text, headers: response.headers };
  }
}

function parseTorrentList(jsonResponse: string): TorrentInfo[] {
  const results: TorrentInfo[] = [];
  const parsed = JSON.parse(jsonResponse) as Array<Record<string, unknown>>;
  for (const item of parsed) {
    results.push({
      title: String(item.name ?? ""),
      name: item.name ? String(item.name) : undefined,
      size: Number(item.size ?? 0),
      seeders: Number(item.num_seeds ?? 0),
      leechers: Number(item.num_leechs ?? 0),
      magnetLink: String(item.magnet_uri ?? ""),
      progress: typeof item.progress === "number" ? item.progress : undefined,
      state: item.state ? String(item.state) : undefined,
      dlSpeed: Number(item.dlspeed ?? 0),
      eta: Number(item.eta ?? 0),
      sourceSite: "qBittorrent",
      hasSubtitle: false,
      hasUncensoredMarker: false,
      uncensoredMarkerType: UncensoredMarkerType.None,
      hasHd: false,
      weightScore: 0,
    });
  }
  return results;
}

function readSidCookie(headers: Headers): string | null {
  const setCookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);

  for (const raw of setCookies) {
    const match = raw.match(/SID=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function normalizeMagnetLink(magnetLink: string): string {
  return decodeHtml(magnetLink).trim();
}

function isOkResponse(responseBody: string): boolean {
  const text = normalizeResponseText(responseBody);
  return text === "" || text.toLowerCase() === "ok" || text.toLowerCase() === "ok.";
}

function normalizeResponseText(responseBody: string): string {
  return (responseBody ?? "").trim();
}

function decodeHtml(text: string): string {
  return text.replace(/&amp;/g, "&");
}

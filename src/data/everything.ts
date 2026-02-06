import { EverythingConfig } from "../config";
import { IEverythingSearchProvider, IHealthChecker } from "../interfaces";
import { FileType, LocalFileInfo } from "../models";
import { HttpHelper } from "../utils/httpHelper";

export class EverythingHttpClient implements IEverythingSearchProvider, IHealthChecker {
  private config: EverythingConfig;
  private http: HttpHelper;

  constructor(config: EverythingConfig, httpHelper?: HttpHelper) {
    this.config = config;
    this.http = httpHelper ?? new HttpHelper();
  }

  get serviceName(): string {
    return "Everything";
  }

  async search(searchTerm: string): Promise<LocalFileInfo[]> {
    this.applyRuntimeConfig();
    const baseUrl = this.getBaseUrl();
    const query = encodeURIComponent(searchTerm);
    const url = `${baseUrl}/?s=${query}&json=1&path_column=1&size_column=1&date_modified_column=1`;
    const response = await this.http.get(url);
    return parseSearchResponse(response);
  }

  async fileExists(javId: string): Promise<boolean> {
    const results = await this.search(javId);
    return results.length > 0;
  }

  async checkHealth(): Promise<{ serviceName: string; isHealthy: boolean; message: string; url?: string }> {
    this.applyRuntimeConfig();
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/?s=test&json=1&count=1`;

    try {
      const response = await this.http.get(url, undefined, 3000);
      const parsed = JSON.parse(response) as { results?: unknown[] };
      if (!Array.isArray(parsed.results)) {
        return { serviceName: this.serviceName, isHealthy: false, message: "Missing results field", url: baseUrl };
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
      throw new Error("Everything.BaseUrl is empty");
    }
    return trimmed;
  }

  private applyRuntimeConfig(): void {
    if (this.config.userName) {
      this.http.setBasicAuth(this.config.userName, this.config.password ?? "");
    } else {
      this.http.removeDefaultHeader("Authorization");
    }
  }
}

function parseSearchResponse(jsonResponse: string): LocalFileInfo[] {
  const results: LocalFileInfo[] = [];
  const parsed = JSON.parse(jsonResponse) as { results?: Array<Record<string, unknown>> };
  if (!parsed.results || !Array.isArray(parsed.results)) {
    return results;
  }

  for (const item of parsed.results) {
    const name = typeof item.name === "string" ? item.name : "";
    const pathValue = typeof item.path === "string" ? item.path : "";
    const size = parseEverythingSize(item.size);
    const modifiedTicks = typeof item.date_modified === "number" ? item.date_modified : 0;
    const fileType = determineFileType(name);

    results.push({
      fileName: name,
      fullPath: pathValue ? `${pathValue}\\${name}` : name,
      size,
      modifiedDate: parseEverythingDateModified(modifiedTicks),
      fileType,
    });
  }

  return results;
}

function parseEverythingSize(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/[,_\s]/g, "");
    if (!normalized) {
      return 0;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return 0;
}

function parseEverythingDateModified(value: number): string {
  if (!value || value <= 0) {
    return "";
  }

  const minUnixSeconds = Math.floor(Date.now() / 1000) - 1000000000;
  const maxUnixSeconds = Math.floor(Date.now() / 1000) + 1000000000;

  if (value >= minUnixSeconds && value <= maxUnixSeconds) {
    return new Date(value * 1000).toISOString();
  }

  const minUnixMs = Date.now() - 1000000000000;
  const maxUnixMs = Date.now() + 1000000000000;
  if (value >= minUnixMs && value <= maxUnixMs) {
    return new Date(value).toISOString();
  }

  const fileTimeMs = value / 10000 - 11644473600000;
  if (!Number.isNaN(fileTimeMs) && fileTimeMs > 0) {
    return new Date(fileTimeMs).toISOString();
  }

  return "";
}

function determineFileType(fileName: string): FileType {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const videoExtensions = new Set(["mp4", "mkv", "avi", "wmv", "mov", "flv", "webm", "m4v"]);
  if (videoExtensions.has(extension)) {
    return FileType.Video;
  }
  if (extension === "torrent") {
    return FileType.Torrent;
  }
  return FileType.Folder;
}

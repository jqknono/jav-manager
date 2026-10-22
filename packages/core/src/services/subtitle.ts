import fs from "fs";
import path from "path";
import { ISubtitleSearchProvider, SubtitleLanguageOption, SubtitleSearchItem, SubtitleSearchResult } from "@jav-manager/domain";
import { buildSubtitleFileName, isExactJavSubtitle, normalizeJavId, pickPreferredLanguage, sanitizeFileName, sortSubtitleItems } from "@jav-manager/shared-utils";
import { SubtitleConfig } from "../config";
import { getPreferredConfigDirectory } from "../utils/appPaths";

export interface SubtitleDownloadResult {
  javId: string;
  savedPath: string;
  languageCode: string;
  source: string;
  title: string;
}

export class SubtitleSearchService {
  private providers: ISubtitleSearchProvider[];
  private config: SubtitleConfig;

  constructor(providers: ISubtitleSearchProvider[], config: SubtitleConfig) {
    this.providers = providers;
    this.config = config;
  }

  async search(javId: string): Promise<SubtitleSearchResult> {
    const normalized = normalizeJavId(javId);
    const messages: string[] = [];
    const collected: SubtitleSearchItem[] = [];

    const searches = await Promise.all(this.providers.map(async (provider) => {
      try {
        const items = await provider.search(normalized);
        return { provider, items, error: "" };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { provider, items: [] as SubtitleSearchItem[], error: message };
      }
    }));

    for (const result of searches) {
      if (result.error) {
        messages.push(`${result.provider.sourceName}: ${result.error}`);
        continue;
      }
      collected.push(...result.items.filter((item) => isExactJavSubtitle(normalized, item.title) || item.matchScore >= 75));
    }

    const ranked = sortSubtitleItems(dedupeSubtitleItems(collected));
    return {
      javId: normalized,
      items: ranked,
      messages,
    };
  }

  async hydrate(item: SubtitleSearchItem): Promise<SubtitleSearchItem> {
    const provider = this.findProvider(item.source);
    if (!provider) {
      return item;
    }
    return provider.getDetail(item);
  }

  async downloadPreferred(item: SubtitleSearchItem, javId: string): Promise<SubtitleDownloadResult> {
    const hydrated = item.languages.length ? item : await this.hydrate(item);
    const language = pickPreferredLanguage(hydrated, this.config.preferredLanguages);
    if (!language) {
      throw new Error("No downloadable subtitle language found");
    }
    return this.downloadLanguage(hydrated, language, javId);
  }

  async downloadLanguage(item: SubtitleSearchItem, language: SubtitleLanguageOption, javId: string): Promise<SubtitleDownloadResult> {
    const provider = this.findProvider(item.source);
    if (!provider) {
      throw new Error(`Unknown subtitle source: ${item.source}`);
    }

    const downloaded = await provider.download(language.downloadUrl);
    const fileName = sanitizeFileName(downloaded.fileName.endsWith(".srt")
      ? downloaded.fileName
      : buildSubtitleFileName(javId, language.code, item.source));
    const savedPath = writeSubtitleFile(this.resolveSaveDirectory(), fileName, downloaded.content);

    return {
      javId: normalizeJavId(javId),
      savedPath,
      languageCode: language.code,
      source: item.source,
      title: item.title,
    };
  }

  private findProvider(source: string): ISubtitleSearchProvider | undefined {
    return this.providers.find((provider) => provider.sourceName.toLowerCase() === String(source ?? "").toLowerCase());
  }

  private resolveSaveDirectory(): string {
    const configured = String(this.config.savePath ?? "").trim();
    if (configured) {
      return configured;
    }
    return path.join(getPreferredConfigDirectory(), "subtitles");
  }
}

function writeSubtitleFile(directory: string, fileName: string, content: Uint8Array): string {
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, fileName);
  fs.writeFileSync(target, content);
  return target;
}

function dedupeSubtitleItems(items: SubtitleSearchItem[]): SubtitleSearchItem[] {
  const seen = new Set<string>();
  const result: SubtitleSearchItem[] = [];
  for (const item of items) {
    const key = `${item.source}|${item.detailUrl || item.title}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

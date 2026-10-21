import enJson from "./localization/en.json";
import zhJson from "./localization/zh.json";
import jaJson from "./localization/ja.json";
import koJson from "./localization/ko.json";

export type Locale = "en" | "zh" | "ja" | "ko";

type StringTable = Record<string, string>;

function sanitizeTable(input: unknown): StringTable {
  if (!input || typeof input !== "object") return {};
  const out: StringTable = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

const stringsEn = sanitizeTable(enJson);
const strings: Record<Locale, StringTable> = {
  en: stringsEn,
  zh: { ...stringsEn, ...sanitizeTable(zhJson) },
  ja: { ...stringsEn, ...sanitizeTable(jaJson) },
  ko: { ...stringsEn, ...sanitizeTable(koJson) },
};

export class LocalizationService {
  private locale: Locale;

  constructor(locale: Locale) {
    this.locale = locale;
  }

  get currentLocale(): Locale {
    return this.locale;
  }

  setLanguage(locale: Locale): void {
    this.locale = locale;
  }

  get(key: string): string {
    return strings[this.locale][key] ?? strings.en[key] ?? key;
  }

  getFormat(key: string, ...args: Array<string | number>): string {
    const template = this.get(key);
    return args.reduce<string>(
      (acc, value, index) => acc.replace(`{${index}}`, String(value)),
      template
    );
  }
}

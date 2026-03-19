import { LOCALES, PAGE_LANGS, PageLang } from './locales.generated';

export { PageLang, PAGE_LANGS };
export type TextDict = typeof LOCALES.en;

const en = LOCALES.en as TextDict;

export const TEXT: Record<PageLang, TextDict> = Object.fromEntries(
  PAGE_LANGS.map((lang) => {
    if (lang === 'en') return [lang, en];
    // Translator-owned; fallback to English for missing keys.
    const partial = LOCALES[lang] as Partial<TextDict>;
    return [lang, { ...en, ...partial } as TextDict];
  })
) as Record<PageLang, TextDict>;


import type { Lang, Narration, Page, Tale, TaleIndexEntry } from './types';

/** Языки, на которых есть сказка: основной + переводы. */
export function taleLangs(tale: Tale): Lang[] {
  const base = tale.lang ?? 'ru';
  const extra = (Object.keys(tale.translations ?? {}) as Lang[]).filter((l) => l !== base);
  return [base, ...extra];
}

/** Язык, на котором реально покажем сказку: выбранный, если он есть, иначе основной. */
export function resolveLang(tale: Tale, wanted: Lang): Lang {
  return taleLangs(tale).includes(wanted) ? wanted : (tale.lang ?? 'ru');
}

export function taleTitle(tale: Tale, lang: Lang): string {
  return tale.translations?.[lang]?.title ?? tale.title;
}

export function entryTitle(entry: TaleIndexEntry, lang: Lang): string {
  return entry.translations?.[lang]?.title ?? entry.title;
}

export interface PageContent {
  lang: Lang;
  text: string;
  narration?: Narration;
}

/** Текст и голос страницы на языке lang (если перевода нет — на основном языке). */
export function pageContent(tale: Tale, page: Page, lang: Lang): PageContent {
  const t = page.translations?.[lang];
  if (t) return { lang, text: t.text, narration: t.narration };
  return { lang: tale.lang ?? 'ru', text: page.text, narration: page.narration };
}

/** Словарик для тапа по слову: только для языка перевода (на основном языке переводить некуда). */
export function glossaryFor(tale: Tale, lang: Lang): Record<string, string> | null {
  return lang === (tale.lang ?? 'ru') ? null : (tale.translations?.[lang]?.glossary ?? null);
}

/** Произношение слов для облачка — тоже только на языке перевода. */
export function pronunciationFor(tale: Tale, lang: Lang): Record<string, string> | null {
  return lang === (tale.lang ?? 'ru') ? null : (tale.translations?.[lang]?.pronunciation ?? null);
}

/** Ключ слова в словарике: нижний регистр, без знаков препинания по краям («Turnip!» → «turnip»). */
export function glossaryKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

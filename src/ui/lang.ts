import type { Lang } from '../engine/types';

const KEY = 'skazki.lang';

/** Выбранный язык сказок; хранится на устройстве, без хранилища — русский. */
export function loadLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* приватный режим / нет хранилища — просто не запоминаем */
  }
}

/** Подпись языка для переключателей. */
export const LANG_NAMES: Record<Lang, { short: string; full: string }> = {
  ru: { short: 'RU', full: 'Русский' },
  en: { short: 'EN', full: 'English' },
};

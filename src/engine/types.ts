/**
 * Модель сказки. Сказка — это ДАННЫЕ (public/tales/<id>/tale.json), а не код.
 * Движок ничего не знает про «Репку»: новая сказка = новый JSON + спрайты/звуки.
 * Эту же модель позже повторит KMP (commonMain, kotlinx.serialization).
 */

/** Языки текста сказок и интерфейса. */
export type Lang = 'ru' | 'en';

export interface TaleIndex {
  tales: TaleIndexEntry[];
}

export interface TaleIndexEntry {
  id: string;
  title: string;
  /** спрайт для обложки в библиотеке */
  coverSprite: string;
  /** название на других языках */
  translations?: Partial<Record<Lang, { title: string }>>;
}

export interface Tale {
  id: string;
  title: string;
  /** язык основного текста (title, page.text, page.narration); по умолчанию ru */
  lang?: Lang;
  /** версия контента — нужна для будущей доставки пакетов (Play Asset Delivery / сервер) */
  version: number;
  pages: Page[];
  /** другие языки сказки; у каждой страницы тогда есть page.translations[lang] */
  translations?: Partial<Record<Lang, TaleTranslation>>;
}

export interface TaleTranslation {
  title: string;
  /**
   * Словарик для тапа по слову: слово (нижний регистр, без знаков препинания по краям)
   * → перевод на основной язык сказки. В тексте перевода не должно быть слов вне словарика —
   * TaleRepository проверяет это при загрузке.
   */
  glossary: Record<string, string>;
  /**
   * Произношение слов словарика буквами основного языка сказки («turnip» → «тёрнип»),
   * ударение — знаком ́ в словах из 2+ слогов. Заполняется `npm run pronounce`
   * (scripts/pronunciation.mjs), ручные правки скрипт не перезаписывает.
   * Если поле есть, TaleRepository проверяет, что у каждого слова словарика есть произношение.
   */
  pronunciation?: Record<string, string>;
}

export interface Page {
  id: string;
  /** текст страницы на основном языке сказки */
  text: string;
  scene: Scene;
  narration?: Narration;
  /** текст и голос страницы на других языках */
  translations?: Partial<Record<Lang, PageTranslation>>;
}

export interface PageTranslation {
  text: string;
  narration?: Narration;
}

export interface Narration {
  /** записанный голос (относительно папки сказки). Нет — используем TTS как временную заглушку */
  src?: string;
}

export interface Scene {
  /** id фона из реестра спрайтов */
  background: string;
  elements: SceneElement[];
  /** именованные группы элементов: «цепочка» тянущих и т.п. */
  groups?: Record<string, string[]>;
  /** что происходит по тапу: id действия → список анимаций */
  actions?: Record<string, AnimationCall[]>;
}

export interface SceneElement {
  id: string;
  sprite: string;
  /** координаты точки «ноги/низ по центру» в системе viewBox 1000×700 */
  x: number;
  y: number;
  scale?: number;
  /** начальное состояние: класс-модификатор, например "small" у ещё не выросшей репки */
  state?: string;
  /** id действия из scene.actions, запускаемого по тапу */
  onTap?: string;
  z?: number;
}

export interface AnimationCall {
  /** id элемента или имя группы */
  target: string;
  /** имя анимации из реестра (engine/animations.ts); можно опустить, если нужен только эффект fx */
  animation?: string;
  /** эффект сцены из реестра (engine/effects.ts): частицы у цели, тряска камеры и т.п. */
  fx?: string;
  delayMs?: number;
  /** звуковой эффект из реестра (audio/Sfx.ts) */
  sfx?: string;
  /** для групп: задержка между элементами (эффект «волны») */
  staggerMs?: number;
}

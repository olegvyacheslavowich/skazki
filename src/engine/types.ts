/**
 * Модель сказки. Сказка — это ДАННЫЕ (public/tales/<id>/tale.json), а не код.
 * Движок ничего не знает про «Репку»: новая сказка = новый JSON + спрайты/звуки.
 * Эту же модель позже повторит KMP (commonMain, kotlinx.serialization).
 */

export interface TaleIndex {
  tales: TaleIndexEntry[];
}

export interface TaleIndexEntry {
  id: string;
  title: string;
  /** спрайт для обложки в библиотеке */
  coverSprite: string;
}

export interface Tale {
  id: string;
  title: string;
  /** версия контента — нужна для будущей доставки пакетов (Play Asset Delivery / сервер) */
  version: number;
  pages: Page[];
}

export interface Page {
  id: string;
  /** текст страницы; слова разбиваются по пробелам — индексы слов используются для подсветки */
  text: string;
  scene: Scene;
  narration?: Narration;
}

export interface Narration {
  /** записанный голос (относительно папки сказки). Нет — используем TTS как временную заглушку */
  src?: string;
  /** время начала каждого слова в мс (для караоке-подсветки записанного голоса) */
  wordStartsMs?: number[];
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

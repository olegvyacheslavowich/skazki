/**
 * КОНТРАКТ МОСТА web ↔ native (Capacitor-плагин «TaleAudio»).
 *
 * Это единственное место, где web-часть договаривается с нативной. На нативной стороне:
 *   Android: TaleAudioPlugin.kt (@CapacitorPlugin(name = "TaleAudio")) → KMP shared: TaleAudioEngine
 *   iOS:     TaleAudioPlugin.swift (CAPPlugin)                          → KMP shared: TaleAudioEngine
 *
 * Правила контракта:
 *  - web передаёт только идентификаторы (taleId/pageId); тексты, тайминги и пути к аудио нативная
 *    сторона читает сама из того же tale.json — один источник правды;
 *  - все методы асинхронные и идемпотентные;
 *  - индексы слов считаются по splitWords(page.text) — KMP повторяет то же правило (\S+).
 *
 * Когда в проект будет добавлен @capacitor/core, объект плагина получаем так:
 *   import { registerPlugin } from '@capacitor/core';
 *   export const TaleAudio = registerPlugin<TaleAudioPlugin>('TaleAudio');
 * До этого используем глобальный window.Capacitor (см. getNativeTaleAudio).
 */

export interface TaleAudioPlugin {
  /** подготовить сказку: нативная сторона читает tale.json, предзагружает аудио */
  openTale(options: { taleId: string }): Promise<void>;

  /** прочитать страницу; события word/ended придут через addListener */
  narrate(options: { taleId: string; pageId: string }): Promise<void>;
  stop(): Promise<void>;

  setMusic(options: { enabled: boolean }): Promise<void>;

  /** жизненный цикл: нативная сторона и сама знает о фоне, но web может попросить явно */
  pause(): Promise<void>;
  resume(): Promise<void>;

  addListener(event: 'word', cb: (e: WordEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: 'ended', cb: (e: EndedEvent) => void): Promise<PluginListenerHandle>;
}

export interface WordEvent {
  pageId: string;
  index: number;
}

export interface EndedEvent {
  pageId: string;
  /** completed — дочитали; interrupted — остановлено (stop, новая страница, звонок) */
  reason: 'completed' | 'interrupted';
}

export interface PluginListenerHandle {
  remove(): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: Record<string, unknown>;
}

/** Плагин доступен только внутри нативной сборки Capacitor, где он зарегистрирован. */
export function getNativeTaleAudio(): TaleAudioPlugin | null {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable('TaleAudio')) return null;
  return (cap.Plugins?.TaleAudio as TaleAudioPlugin | undefined) ?? null;
}

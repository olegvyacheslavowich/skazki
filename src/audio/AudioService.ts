import type { Lang, Narration } from '../engine/types';

/**
 * Единственная точка, через которую UI работает со звуком.
 *
 * Сейчас есть две реализации:
 *  - WebAudioService — всё в браузере (TTS-заглушка, музыка и эффекты синтезируются Web Audio);
 *  - NativeAudioService — озвучка и музыка уходят в Capacitor-плагин TaleAudio,
 *    за которым стоит KMP-модуль (ExoPlayer на Android, AVAudioEngine на iOS).
 * UI не знает, какая из них работает.
 */
export interface AudioService {
  readonly kind: 'web' | 'native';
  /** вызвать по первому жесту пользователя (политики автовоспроизведения браузеров/iOS) */
  unlock(): Promise<void>;
  narrate(req: NarrationRequest, listener: NarrationListener): void;
  /** останавливает и чтение страницы, и озвучку слова */
  stopNarration(): void;
  /**
   * Произнести одно слово (кнопка-динамик в облачке над словом). Прерывает чтение страницы.
   * Сейчас — системный TTS; когда появятся записи слов, поменяется только реализация.
   */
  speakWord(word: string, lang: Lang): void;
  /**
   * Весь звук книжки: музыка, голос и эффекты тапов. Выключили — сразу тишина
   * (музыка гаснет, чтение обрывается, тапы беззвучны). Авточтение UI сам не запускает, пока звук выключен.
   */
  setSoundEnabled(on: boolean): void;
  isSoundEnabled(): boolean;
  /** эффект тапа; при выключенном звуке — ничего */
  playSfx(name: string): void;
  /** приложение ушло в фон / вернулось */
  suspend(): void;
  resume(): void;
}

export interface NarrationRequest {
  taleId: string;
  /** базовый URL папки сказки — для относительных путей к аудиофайлам */
  taleBaseUrl: string;
  pageId: string;
  /** язык, на котором читаем */
  lang: Lang;
  /** текст страницы на этом языке */
  text: string;
  /** записанный голос на этом языке; нет — TTS-заглушка */
  narration?: Narration;
}

export interface NarrationListener {
  /** дочитали или остановили */
  onEnd(): void;
}

/** Внутренний интерфейс web-движков озвучки. */
export interface NarrationEngine {
  start(req: NarrationRequest, listener: NarrationListener): void;
  stop(): void;
}

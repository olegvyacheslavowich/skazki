import type { Page } from '../engine/types';

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
  stopNarration(): void;
  setMusicEnabled(on: boolean): void;
  isMusicEnabled(): boolean;
  playSfx(name: string): void;
  /** приложение ушло в фон / вернулось */
  suspend(): void;
  resume(): void;
}

export interface NarrationRequest {
  taleId: string;
  /** базовый URL папки сказки — для относительных путей к аудиофайлам */
  taleBaseUrl: string;
  page: Page;
}

export interface NarrationListener {
  /** началось слово с индексом index (по splitWords(page.text)) */
  onWord(index: number): void;
  onEnd(): void;
}

/** Внутренний интерфейс web-движков озвучки. */
export interface NarrationEngine {
  start(req: NarrationRequest, listener: NarrationListener): void;
  stop(): void;
}

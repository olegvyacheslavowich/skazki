import type { AudioService, NarrationListener, NarrationRequest } from '../audio/AudioService';
import { Sfx } from '../audio/Sfx';
import { WebSpeechNarration } from '../audio/WebSpeechNarration';
import type { Lang } from '../engine/types';
import type { PluginListenerHandle, TaleAudioPlugin } from './TaleAudioPlugin';

/**
 * Реализация AudioService поверх нативного плагина (KMP).
 * Голос и музыка — нативно (стабильная задержка, фоновый режим, аудиофокус, звонки);
 * короткие эффекты на тапы остаются в Web Audio.
 */
export class NativeAudioService implements AudioService {
  readonly kind = 'native' as const;
  private ctx: AudioContext | null = null;
  private sfx: Sfx | null = null;
  private musicOn = true;
  private openedTale: string | null = null;
  private current: { pageId: string; listener: NarrationListener } | null = null;
  private handles: PluginListenerHandle[] = [];
  /** запасной голос для слов, пока плагин не умеет speakWord (WKWebView умеет, Android WebView — обычно нет) */
  private webTts: WebSpeechNarration | null = null;

  constructor(private readonly plugin: TaleAudioPlugin) {}

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.sfx = new Sfx(this.ctx);
      this.handles.push(
        await this.plugin.addListener('ended', (e) => {
          if (e.pageId !== this.current?.pageId) return;
          const l = this.current.listener;
          this.current = null;
          l.onEnd();
        }),
      );
    }
    await this.ctx.resume();
    await this.plugin.setMusic({ enabled: this.musicOn });
  }

  narrate(req: NarrationRequest, listener: NarrationListener): void {
    this.current = { pageId: req.pageId, listener };
    const open = this.openedTale === req.taleId ? Promise.resolve() : this.plugin.openTale({ taleId: req.taleId });
    open
      .then(() => {
        this.openedTale = req.taleId;
        return this.plugin.narrate({ taleId: req.taleId, pageId: req.pageId, lang: req.lang });
      })
      .catch((err) => {
        console.error('TaleAudio.narrate', err);
        this.current = null;
        listener.onEnd();
      });
  }

  stopNarration(): void {
    this.current = null;
    this.webTts?.stop();
    void this.plugin.stop();
  }

  speakWord(word: string, lang: Lang): void {
    this.stopNarration();
    if (this.plugin.speakWord) {
      this.plugin.speakWord({ text: word, lang }).catch((err) => console.error('TaleAudio.speakWord', err));
      return;
    }
    this.webTts ??= new WebSpeechNarration();
    this.webTts.speakWord(word, lang, () => {});
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    void this.plugin.setMusic({ enabled: on });
  }

  isMusicEnabled(): boolean {
    return this.musicOn;
  }

  playSfx(name: string): void {
    this.sfx?.play(name);
  }

  suspend(): void {
    void this.plugin.pause();
    this.ctx?.suspend();
  }

  resume(): void {
    void this.plugin.resume();
    this.ctx?.resume();
  }
}

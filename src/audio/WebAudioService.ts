import type { AudioService, NarrationListener, NarrationRequest } from './AudioService';
import { Music } from './Music';
import { Sfx } from './Sfx';
import { RecordedNarration } from './RecordedNarration';
import { WebSpeechNarration } from './WebSpeechNarration';

/** Реализация «всё в браузере»: для разработки и для PWA-версии. */
export class WebAudioService implements AudioService {
  readonly kind = 'web' as const;
  private ctx: AudioContext | null = null;
  private music: Music | null = null;
  private sfx: Sfx | null = null;
  private musicOn = true;
  private readonly tts = new WebSpeechNarration();
  private readonly recorded = new RecordedNarration();

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.music = new Music(this.ctx);
      this.sfx = new Sfx(this.ctx);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.musicOn) this.music!.start();
  }

  narrate(req: NarrationRequest, listener: NarrationListener): void {
    this.stopNarration();
    this.music?.duck(true);
    const engine = req.narration?.src ? this.recorded : this.tts;
    engine.start(req, {
      onEnd: () => {
        this.music?.duck(false);
        listener.onEnd();
      },
    });
  }

  stopNarration(): void {
    this.tts.stop();
    this.recorded.stop();
    this.music?.duck(false);
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    if (on) this.music?.start();
    else this.music?.stop();
  }

  isMusicEnabled(): boolean {
    return this.musicOn;
  }

  playSfx(name: string): void {
    this.sfx?.play(name);
  }

  suspend(): void {
    this.stopNarration();
    this.ctx?.suspend();
  }

  resume(): void {
    this.ctx?.resume();
  }
}

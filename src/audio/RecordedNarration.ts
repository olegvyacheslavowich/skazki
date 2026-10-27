import type { NarrationEngine, NarrationListener, NarrationRequest } from './AudioService';

/** Озвучка записанным голосом (narration.src страницы на нужном языке). */
export class RecordedNarration implements NarrationEngine {
  private audio: HTMLAudioElement | null = null;

  start(req: NarrationRequest, l: NarrationListener): void {
    this.stop();
    const audio = new Audio(`${req.taleBaseUrl}/${req.narration!.src}`);
    this.audio = audio;
    const end = () => {
      if (this.audio !== audio) return;
      this.stop();
      l.onEnd();
    };
    audio.onended = end;
    audio.onerror = end;
    audio.play().catch(end);
  }

  stop(): void {
    if (!this.audio) return;
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.pause();
    this.audio = null;
  }
}

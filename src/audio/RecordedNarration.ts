import type { NarrationEngine, NarrationListener, NarrationRequest } from './AudioService';
import { estimateWordStarts, splitWords } from '../engine/words';

/**
 * Озвучка записанным голосом (page.narration.src) с таймингами слов (page.narration.wordStartsMs).
 * Если тайминги не размечены — растягиваем оценочные на реальную длину файла.
 */
export class RecordedNarration implements NarrationEngine {
  private audio: HTMLAudioElement | null = null;
  private raf = 0;

  start(req: NarrationRequest, l: NarrationListener): void {
    this.stop();
    const n = req.page.narration!;
    const audio = new Audio(`${req.taleBaseUrl}/${n.src}`);
    this.audio = audio;
    const words = splitWords(req.page.text);
    let starts = n.wordStartsMs;
    let last = -1;

    const tick = () => {
      if (this.audio !== audio) return;
      if (!starts && Number.isFinite(audio.duration)) {
        const est = estimateWordStarts(words);
        const k = (audio.duration * 1000 * 0.95) / (est[est.length - 1] + 400);
        starts = est.map((t) => t * k);
      }
      if (starts) {
        const now = audio.currentTime * 1000;
        let i = last;
        while (i + 1 < starts.length && starts[i + 1] <= now) i++;
        if (i !== last && i >= 0) l.onWord((last = i));
      }
      this.raf = requestAnimationFrame(tick);
    };

    audio.onended = () => {
      this.stop();
      l.onEnd();
    };
    audio.onerror = () => {
      this.stop();
      l.onEnd();
    };
    audio.play().then(() => (this.raf = requestAnimationFrame(tick))).catch(() => l.onEnd());
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
  }
}

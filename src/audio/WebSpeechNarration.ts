import type { NarrationEngine, NarrationListener, NarrationRequest } from './AudioService';
import { estimateWordStarts, splitWords, wordIndexAt } from '../engine/words';

const RATE = 0.85;
const HAS_TTS = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

/**
 * Временная озвучка системным TTS (speechSynthesis).
 * Для двухлеток TTS — только заглушка разработки: финально будет записанный голос (RecordedNarration
 * или нативный плеер в KMP).
 *
 * Подсветка слов: boundary-события TTS, а если платформа их не шлёт (iOS, часть Android) —
 * оценочные тайминги.
 */
export class WebSpeechNarration implements NarrationEngine {
  private timers: number[] = [];
  private session = 0;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (!(HAS_TTS)) return;
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      this.voice =
        voices.find((v) => v.lang.toLowerCase().startsWith('ru') && /milena|katya|alena|female|жен/i.test(v.name)) ??
        voices.find((v) => v.lang.toLowerCase().startsWith('ru')) ??
        null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  start(req: NarrationRequest, l: NarrationListener): void {
    this.stop();
    const session = ++this.session;
    const words = splitWords(req.page.text);
    const starts = estimateWordStarts(words, RATE);
    const total = starts[starts.length - 1] + 900;

    let gotBoundary = false;
    let ended = false;
    const finish = () => {
      if (ended || session !== this.session) return;
      ended = true;
      this.clearTimers();
      l.onEnd();
    };
    const runEstimated = (offsetMs: number) => {
      starts.forEach((t, i) => {
        this.timers.push(window.setTimeout(() => !gotBoundary && session === this.session && l.onWord(i), t + offsetMs));
      });
    };

    let started = false;
    /** нет TTS / нет русского голоса / ошибка синтеза — «читаем глазами» по оценочным таймингам */
    const silentReading = () => {
      if (started || session !== this.session) return;
      started = true;
      this.clearTimers();
      runEstimated(0);
      this.timers.push(window.setTimeout(finish, total));
    };

    if (!HAS_TTS) return silentReading();

    const u = new SpeechSynthesisUtterance(req.page.text);
    u.lang = 'ru-RU';
    u.rate = RATE;
    u.pitch = 1.05;
    if (this.voice) u.voice = this.voice;
    u.onstart = () => {
      if (started || session !== this.session) return;
      started = true;
      l.onWord(0);
      runEstimated(0);
      // страховка: некоторые WebView не присылают onend
      this.timers.push(window.setTimeout(finish, total * 1.6 + 3000));
    };
    u.onboundary = (e) => {
      if (session !== this.session || e.name === 'sentence') return;
      gotBoundary = true;
      l.onWord(wordIndexAt(words, e.charIndex));
    };
    u.onend = () => (started ? finish() : silentReading());
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return finish();
      started ? finish() : silentReading();
    };
    // если синтез так и не стартовал (нет голосов) — не оставляем ребёнка без подсветки
    this.timers.push(window.setTimeout(silentReading, 1500));
    speechSynthesis.speak(u);
  }

  stop(): void {
    this.session++;
    this.clearTimers();
    if (HAS_TTS) speechSynthesis.cancel();
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

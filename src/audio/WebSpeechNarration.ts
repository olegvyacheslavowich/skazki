import type { NarrationEngine, NarrationListener, NarrationRequest } from './AudioService';
import type { Lang } from '../engine/types';
import { estimateReadingMs } from '../engine/words';

const RATE = 0.85;
/** отдельное слово — помедленнее, чтобы расслышать */
const WORD_RATE = 0.7;
const WORD_TIMEOUT_MS = 4000;
const HAS_TTS = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

const BCP47: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US' };
/** предпочитаем мягкие женские голоса, если они есть в системе */
const PREFERRED: Record<Lang, RegExp> = {
  ru: /milena|katya|alena|female|жен/i,
  en: /samantha|karen|moira|serena|tessa|aria|jenny|zira|female/i,
};

/**
 * Временная озвучка системным TTS (speechSynthesis).
 * Для двухлеток TTS — только заглушка разработки: финально будет записанный голос (RecordedNarration
 * или нативный плеер в KMP).
 */
export class WebSpeechNarration implements NarrationEngine {
  private timers: number[] = [];
  private session = 0;
  private voices: Partial<Record<Lang, SpeechSynthesisVoice>> = {};

  constructor() {
    if (!HAS_TTS) return;
    const pick = () => {
      const all = speechSynthesis.getVoices();
      for (const lang of Object.keys(BCP47) as Lang[]) {
        const own = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
        const v = own.find((x) => PREFERRED[lang].test(x.name)) ?? own[0];
        if (v) this.voices[lang] = v;
        else delete this.voices[lang];
      }
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  start(req: NarrationRequest, l: NarrationListener): void {
    this.stop();
    const session = ++this.session;
    const total = estimateReadingMs(req.text, RATE) + 900;

    let ended = false;
    const finish = () => {
      if (ended || session !== this.session) return;
      ended = true;
      this.clearTimers();
      l.onEnd();
    };

    let started = false;
    /** нет TTS / голоса / синтез упал — «читаем про себя»: кнопка вернётся через оценочное время */
    const silentReading = () => {
      if (started || session !== this.session) return;
      started = true;
      this.clearTimers();
      this.timers.push(window.setTimeout(finish, total));
    };

    if (!HAS_TTS) return silentReading();

    const u = new SpeechSynthesisUtterance(req.text);
    u.lang = BCP47[req.lang];
    u.rate = RATE;
    u.pitch = 1.05;
    const voice = this.voices[req.lang];
    if (voice) u.voice = voice;
    u.onstart = () => {
      if (started || session !== this.session) return;
      started = true;
      // страховка: некоторые WebView не присылают onend
      this.timers.push(window.setTimeout(finish, total * 1.6 + 3000));
    };
    u.onend = () => (started ? finish() : silentReading());
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return finish();
      started ? finish() : silentReading();
    };
    // синтез так и не стартовал (нет голосов) — не держим кнопку в состоянии «читаю» вечно
    this.timers.push(window.setTimeout(silentReading, 1500));
    speechSynthesis.speak(u);
  }

  /** Одно слово по кнопке в облачке. onEnd — когда договорили (или озвучить нечем). */
  speakWord(word: string, lang: Lang, onEnd: () => void): void {
    this.stop();
    const session = this.session;
    let ended = false;
    const finish = () => {
      if (ended || session !== this.session) return;
      ended = true;
      this.clearTimers();
      onEnd();
    };
    if (!HAS_TTS) return finish();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = BCP47[lang];
    u.rate = WORD_RATE;
    u.pitch = 1.05;
    const voice = this.voices[lang];
    if (voice) u.voice = voice;
    u.onend = finish;
    u.onerror = finish;
    // страховка: WebView без onend / нет голосов
    this.timers.push(window.setTimeout(finish, WORD_TIMEOUT_MS));
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

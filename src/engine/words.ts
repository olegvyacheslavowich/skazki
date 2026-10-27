export interface WordSpan {
  text: string;
  start: number;
  end: number;
}

/** Разбивка текста на «слова» (последовательности без пробелов, пунктуация остаётся со словом). */
export function splitWords(text: string): WordSpan[] {
  const out: WordSpan[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    out.push({ text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

/**
 * Грубая оценка длительности чтения в темпе детской сказки, мс.
 * Нужна, когда голоса нет (нет TTS или голоса для языка): кнопка «Читать» вернётся
 * в исходное состояние примерно тогда, когда взрослый дочитал бы страницу вслух.
 */
export function estimateReadingMs(text: string, rate = 1): number {
  let t = 0;
  for (const w of splitWords(text)) {
    const letters = w.text.replace(/[^\p{L}]/gu, '').length;
    let d = 140 + letters * 62;
    if (/[.!?]$/.test(w.text)) d += 420;
    else if (/[,—:;-]$/.test(w.text) || w.text === '—') d += 220;
    t += d / rate;
  }
  return t;
}

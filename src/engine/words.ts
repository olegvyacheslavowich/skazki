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

/** Индекс слова по позиции символа (для boundary-событий speechSynthesis). */
export function wordIndexAt(words: WordSpan[], charIndex: number): number {
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].start <= charIndex) return i;
  }
  return 0;
}

/**
 * Грубая оценка таймингов слов для темпа детского чтения.
 * Используется, когда нет ни записанных таймингов, ни boundary-событий от TTS.
 */
export function estimateWordStarts(words: WordSpan[], rate = 1): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const w of words) {
    starts.push(t);
    const letters = w.text.replace(/[^\p{L}]/gu, '').length;
    let d = 140 + letters * 62;
    if (/[.!?]$/.test(w.text)) d += 420;
    else if (/[,—:;-]$/.test(w.text) || w.text === '—') d += 220;
    t += d / rate;
  }
  return starts;
}

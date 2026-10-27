import type { Lang } from '../engine/types';
import { splitWords } from '../engine/words';
import { glossaryKey } from '../engine/i18n';

/** сколько висит облачко с переводом */
const BUBBLE_MS = 3500;

/**
 * Текст страницы. Слова — отдельные span: на языке перевода тап по слову показывает
 * его перевод из словарика сказки в облачке над словом.
 */
export class TextPanel {
  private readonly bubble: HTMLElement;
  private timer = 0;

  /**
   * @param host  элемент с текстом
   * @param layer позиционированный предок, в котором живёт облачко (чтобы его не обрезал скролл текста)
   */
  constructor(
    private readonly host: HTMLElement,
    private readonly layer: HTMLElement,
  ) {
    this.bubble = document.createElement('div');
    this.bubble.className = 'word-bubble';
    this.bubble.setAttribute('role', 'status');
    this.bubble.setAttribute('aria-live', 'polite');
    layer.append(this.bubble);
    layer.addEventListener('click', (e) => {
      const word = (e.target as Element).closest<HTMLElement>('.w[data-tr]');
      if (word && host.contains(word)) this.showTranslation(word);
      else this.hideTranslation();
    });
  }

  /** @param glossary словарик «слово → перевод»; null — слова не переводятся (основной язык) */
  setText(text: string, lang: Lang, glossary: Record<string, string> | null): void {
    this.hideTranslation();
    this.host.lang = lang;
    this.host.classList.toggle('translatable', glossary !== null);
    const inner = document.createElement('span');
    inner.className = 'inner';
    splitWords(text).forEach((w, i) => {
      if (i) inner.append(' ');
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w.text;
      const tr = glossary?.[glossaryKey(w.text)];
      if (tr) s.dataset.tr = tr;
      inner.append(s);
    });
    this.host.replaceChildren(inner);
  }

  hideTranslation(): void {
    clearTimeout(this.timer);
    this.bubble.classList.remove('show');
  }

  private showTranslation(word: HTMLElement): void {
    clearTimeout(this.timer);
    this.bubble.textContent = word.dataset.tr!;
    this.bubble.classList.remove('show', 'below');

    // облачко над словом, по центру; не вылезает за края страницы; нет места сверху — под словом
    const box = this.layer.getBoundingClientRect();
    const w = word.getBoundingClientRect();
    const b = this.bubble.getBoundingClientRect();
    const gap = 12;
    const cx = w.left + w.width / 2 - box.left;
    const x = Math.min(Math.max(cx - b.width / 2, 8), box.width - b.width - 8);
    let y = w.top - box.top - b.height - gap;
    const below = y < 8;
    if (below) y = w.bottom - box.top + gap;

    this.bubble.style.left = `${x}px`;
    this.bubble.style.top = `${y}px`;
    this.bubble.style.setProperty('--arrow-x', `${cx - x}px`);
    this.bubble.classList.toggle('below', below);
    void this.bubble.offsetWidth; // перезапуск появления, если облачко уже было открыто
    this.bubble.classList.add('show');
    this.timer = window.setTimeout(() => this.hideTranslation(), BUBBLE_MS);
  }
}

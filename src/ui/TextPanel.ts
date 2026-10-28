import type { Lang } from '../engine/types';
import { splitWords } from '../engine/words';
import { glossaryKey } from '../engine/i18n';
import { icon } from './icons';

/** сколько висит облачко; после нажатия на динамик отсчёт начинается заново */
const BUBBLE_MS = 5000;

/** нажали на динамик в облачке: произнести слово (ключ словарика: «Turnip!» → «turnip») */
export type SpeakWord = (word: string, lang: Lang) => void;

/**
 * Текст страницы. Слова — отдельные span: на языке перевода тап по слову показывает облачко
 * над словом: произношение русскими буквами, перевод из словарика сказки и кнопку-динамик.
 */
export class TextPanel {
  private readonly bubble: HTMLElement;
  private readonly pronEl: HTMLElement;
  private readonly trEl: HTMLElement;
  private readonly sayBtn: HTMLButtonElement;
  private timer = 0;
  private lang: Lang = 'ru';
  /** слово, для которого открыто облачко */
  private current: string | null = null;

  /**
   * @param host    элемент с текстом
   * @param layer   позиционированный предок, в котором живёт облачко (чтобы его не обрезал скролл текста)
   * @param onSpeak нажали на динамик в облачке
   * @param onWordShown показали облачко с переводом (человек понял, что слова нажимаются)
   */
  constructor(
    private readonly host: HTMLElement,
    private readonly layer: HTMLElement,
    private readonly onSpeak: SpeakWord,
    private readonly onWordShown?: () => void,
  ) {
    this.bubble = document.createElement('div');
    this.bubble.className = 'word-bubble';
    this.bubble.setAttribute('role', 'status');
    this.bubble.setAttribute('aria-live', 'polite');
    this.bubble.innerHTML = `
      <button class="say" type="button" aria-label="Послушать слово">${icon('speaker')}</button>
      <span class="wb-text"><span class="wb-pron"></span><span class="wb-tr"></span></span>`;
    this.pronEl = this.bubble.querySelector('.wb-pron')!;
    this.trEl = this.bubble.querySelector('.wb-tr')!;
    this.sayBtn = this.bubble.querySelector('.say')!;
    layer.append(this.bubble);

    layer.addEventListener('click', (e) => {
      const target = e.target as Element;
      if (this.sayBtn.contains(target)) return this.speak();
      if (this.bubble.contains(target)) return;
      const word = target.closest<HTMLElement>('.w[data-tr]');
      if (word && host.contains(word)) this.show(word);
      else this.hideTranslation();
    });
  }

  /**
   * @param glossary      словарик «слово → перевод»; null — слова не переводятся (основной язык)
   * @param pronunciation «слово → произношение русскими буквами»; null/нет слова — строка не показывается
   */
  setText(
    text: string,
    lang: Lang,
    glossary: Record<string, string> | null,
    pronunciation: Record<string, string> | null = null,
  ): void {
    this.hideTranslation();
    this.lang = lang;
    this.host.lang = lang;
    this.host.classList.toggle('translatable', glossary !== null);
    const inner = document.createElement('span');
    inner.className = 'inner';
    splitWords(text).forEach((w, i) => {
      if (i) inner.append(' ');
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w.text;
      const key = glossaryKey(w.text);
      const tr = glossary?.[key];
      if (tr) {
        s.dataset.tr = tr;
        s.dataset.key = key;
        const pr = pronunciation?.[key];
        if (pr) s.dataset.pron = pr;
      }
      inner.append(s);
    });
    this.host.replaceChildren(inner);
  }

  hideTranslation(): void {
    clearTimeout(this.timer);
    this.current = null;
    this.bubble.classList.remove('show');
  }

  private speak(): void {
    if (!this.current) return;
    this.onSpeak(this.current, this.lang);
    this.sayBtn.classList.remove('pulse');
    void this.sayBtn.offsetWidth;
    this.sayBtn.classList.add('pulse');
    this.restartTimer();
  }

  private restartTimer(): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hideTranslation(), BUBBLE_MS);
  }

  private show(word: HTMLElement): void {
    this.current = word.dataset.key ?? glossaryKey(word.textContent ?? '');
    this.pronEl.textContent = word.dataset.pron ? `[${word.dataset.pron}]` : '';
    this.pronEl.hidden = !word.dataset.pron;
    this.trEl.textContent = word.dataset.tr!;
    this.sayBtn.setAttribute('aria-label', `Послушать: ${this.current}`);
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
    this.restartTimer();
    this.onWordShown?.();
  }

  /** слово, на которое показать подсказку «нажми на слово»: первое длинное переводимое (координаты окна) */
  hintPoint(): { x: number; y: number; top: number } | null {
    const words = [...this.host.querySelectorAll<HTMLElement>('.w[data-tr]')];
    const w = words.find((x) => (x.textContent ?? '').length >= 4) ?? words[0];
    if (!w) return null;
    const r = w.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom - r.height * 0.2, top: r.top };
  }
}

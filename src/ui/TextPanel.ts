import { splitWords } from '../engine/words';

/** Текст страницы, разбитый на слова, с подсветкой текущего слова озвучки. */
export class TextPanel {
  private spans: HTMLSpanElement[] = [];
  private current = -1;

  constructor(private readonly host: HTMLElement) {}

  setText(text: string): void {
    const inner = document.createElement('span');
    inner.className = 'inner';
    this.host.replaceChildren(inner);
    this.spans = splitWords(text).map((w) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w.text;
      return s;
    });
    this.spans.forEach((s, i) => {
      if (i) inner.append(' ');
      inner.append(s);
    });
    this.current = -1;
  }

  highlight(index: number): void {
    if (index === this.current) return;
    this.spans[this.current]?.classList.remove('on');
    for (let i = 0; i < index; i++) this.spans[i]?.classList.add('read');
    this.spans[index]?.classList.add('on');
    this.current = index;
  }

  clear(): void {
    this.spans.forEach((s) => s.classList.remove('on', 'read'));
    this.current = -1;
  }
}

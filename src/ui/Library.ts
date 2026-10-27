import type { Lang, TaleIndex } from '../engine/types';
import type { SpriteRegistry } from '../art/sprites';
import { entryTitle } from '../engine/i18n';
import { LANG_NAMES } from './lang';

/** Полка со сказками. Первый тап здесь заодно «разблокирует» звук (политики автовоспроизведения). */
export class Library {
  private readonly root: HTMLElement;

  constructor(
    host: HTMLElement,
    private readonly index: TaleIndex,
    sprites: SpriteRegistry,
    private lang: Lang,
    onOpen: (id: string) => void,
    onLangChange: (lang: Lang) => void,
  ) {
    // языки, на которых есть хотя бы одна сказка
    const langs = new Set<Lang>(['ru']);
    index.tales.forEach((t) => Object.keys(t.translations ?? {}).forEach((l) => langs.add(l as Lang)));
    this.root = document.createElement('div');
    this.root.className = 'library';
    this.root.innerHTML = `
      <h1>Сказки</h1>
      <div class="langs" role="group" aria-label="Язык сказок"${langs.size > 1 ? '' : ' hidden'}>
        ${[...langs].map((l) => `<button data-lang="${l}">${LANG_NAMES[l].full}</button>`).join('')}
      </div>
      <div class="shelf">
        ${index.tales
          .map(
            (t) => `
          <button class="cover" data-id="${t.id}">
            <svg viewBox="560 250 440 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              ${sprites.has('defs') ? sprites.markup('defs') : ''}<g>${sprites.markup('field')}</g>
              <g transform="translate(820 560)"><g class="bob">${sprites.markup(t.coverSprite)}</g></g>
              <g>${sprites.has('field-front') ? sprites.markup('field-front') : ''}</g>
            </svg>
            <span></span>
          </button>`,
          )
          .join('')}
      </div>`;
    this.root.addEventListener('click', (e) => {
      const target = e.target as Element;
      const langBtn = target.closest<HTMLButtonElement>('.langs button');
      if (langBtn) {
        this.lang = langBtn.dataset.lang as Lang;
        this.render();
        onLangChange(this.lang);
        return;
      }
      const btn = target.closest<HTMLButtonElement>('.cover');
      if (btn) onOpen(btn.dataset.id!);
    });
    this.render();
    host.appendChild(this.root);
  }

  private render(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.langs button').forEach((b) => {
      const on = b.dataset.lang === this.lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    this.root.querySelectorAll<HTMLButtonElement>('.cover').forEach((c) => {
      const entry = this.index.tales.find((t) => t.id === c.dataset.id)!;
      c.querySelector('span')!.textContent = entryTitle(entry, this.lang);
    });
  }

  destroy(): void {
    this.root.remove();
  }
}

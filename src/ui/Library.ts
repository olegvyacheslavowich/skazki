import type { TaleIndex } from '../engine/types';
import type { SpriteRegistry } from '../art/sprites';

/** Полка со сказками. Первый тап здесь заодно «разблокирует» звук (политики автовоспроизведения). */
export class Library {
  private readonly root: HTMLElement;

  constructor(host: HTMLElement, index: TaleIndex, sprites: SpriteRegistry, onOpen: (id: string) => void) {
    this.root = document.createElement('div');
    this.root.className = 'library';
    this.root.innerHTML = `
      <h1>Сказки</h1>
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
            <span>${t.title}</span>
          </button>`,
          )
          .join('')}
      </div>`;
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('.cover');
      if (btn) onOpen(btn.dataset.id!);
    });
    host.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }
}

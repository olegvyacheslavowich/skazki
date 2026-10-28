import type { HintId } from './prefs';

/** рука «нажми»: viewBox 64×80, кончик пальца — (22, 3) */
const HAND_SVG = `
<svg viewBox="0 0 64 80" aria-hidden="true">
  <g fill="#fff" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round">
    <path d="M15.5 9.5a6.5 6.5 0 0 1 13 0V36h-13Z"/>
    <path d="M28.5 34V31a6 6 0 0 1 12 0v4"/>
    <path d="M40.5 35V33a5.5 5.5 0 0 1 11 0v5"/>
    <path d="M15.5 36h30a10 10 0 0 1 10 10v8c0 12-9 22-21 22h-4C18 76 9 67 9 55v-7a6.5 6.5 0 0 1 6.5-6.5Z"/>
  </g>
  <path d="M15.5 36v8" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
</svg>`;
const VIEW_W = 64;
const VIEW_H = 80;
const TIP = { x: 22, y: 3 };
/** ширина руки на экране, px */
const HAND_W = 58;
const GAP = 8;

/**
 * Подсказка первого открытия: рука «стучит» пальцем по герою или слову, рядом короткая подпись.
 * Ничего не перехватывает (pointer-events: none) — тап проходит сквозь руку к герою.
 */
export class Hints {
  private readonly el: HTMLElement;
  private readonly hand: HTMLElement;
  private readonly label: HTMLElement;
  private shown: HintId | null = null;

  /** @param layer позиционированный контейнер экрана, в котором рисуется подсказка */
  constructor(private readonly layer: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'coach';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `<div class="coach-hand"><i class="coach-ring"></i>${HAND_SVG}</div><div class="coach-label"></div>`;
    this.hand = this.el.querySelector('.coach-hand')!;
    this.label = this.el.querySelector('.coach-label')!;
    layer.append(this.el);
  }

  /** какая подсказка сейчас на экране */
  get current(): HintId | null {
    return this.shown;
  }

  /**
   * @param point куда указывает палец, в координатах окна (clientX/clientY); top — верх цели (подпись «над» встанет выше него)
   * @param place где подпись: под рукой (по умолчанию) или над пальцем — чтобы не закрывать текст;
   *              bounds — область окна, из которой подпись не вылезает (например, страница с текстом)
   */
  show(id: HintId, point: { x: number; y: number; top?: number }, text: string, place: { above?: boolean; bounds?: DOMRect } = {}): void {
    const box = this.layer.getBoundingClientRect();
    const scale = HAND_W / VIEW_W;
    const handH = VIEW_H * scale;
    const px = point.x - box.left;
    const py = point.y - box.top;

    this.label.textContent = text;
    this.el.classList.remove('show');
    this.el.style.setProperty('--tip-x', `${TIP.x * scale}px`);
    this.el.style.setProperty('--tip-y', `${TIP.y * scale}px`);
    Object.assign(this.hand.style, {
      left: `${px - TIP.x * scale}px`,
      top: `${py - TIP.y * scale}px`,
      width: `${HAND_W}px`,
      height: `${handH}px`,
    });

    // подпись по центру пальца, под рукой или над ней; не помещается — с другой стороны; не вылезает за края
    const lw = this.label.offsetWidth;
    const lh = this.label.offsetHeight;
    const b = place.bounds ?? box;
    const minX = b.left - box.left + GAP;
    const maxX = b.right - box.left - lw - GAP;
    const below = py + handH + GAP;
    const above = (point.top ?? point.y) - box.top - lh - GAP;
    const fitsBelow = below + lh <= b.bottom - box.top - GAP;
    const fitsAbove = above >= b.top - box.top + GAP;
    const ly = place.above ? (fitsAbove || !fitsBelow ? above : below) : fitsBelow || !fitsAbove ? below : above;
    const lx = Math.min(Math.max(px - lw / 2, minX), maxX);
    Object.assign(this.label.style, { left: `${lx}px`, top: `${ly}px` });

    void this.el.offsetWidth; // перезапуск появления
    this.el.classList.add('show');
    this.shown = id;
  }

  hide(): void {
    this.el.classList.remove('show');
    this.shown = null;
  }

  destroy(): void {
    this.el.remove();
  }
}

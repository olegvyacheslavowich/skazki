import type { AnimationCall, Scene, SceneElement } from './types';
import type { SpriteRegistry } from '../art/sprites';
import { getAnimation } from './animations';
import { getEffect, ripple, type FxTarget } from './effects';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** запас вокруг спрайта для попадания пальцем, в единицах viewBox */
const HIT_PADDING = 28;
/** глубина слоя с персонажами для параллакса (фон — меньше, передний план — больше) */
const WORLD_DEPTH = 0.8;
/** максимальный сдвиг слоя глубины 1 при параллаксе, в единицах viewBox */
const PARALLAX_RANGE = 22;

export interface SceneCallbacks {
  /** звуковой эффект для анимации */
  onSfx(name: string): void;
  /** тап по элементу (для аналитики / будущего нативного слоя) */
  onTap?(elementId: string): void;
}

/** анимации из JS (WAAPI), а не CSS-«жизнь» (дыхание, моргание) — их не трогаем */
const isScripted = (a: Animation) => !('animationName' in a);

interface Node {
  def: SceneElement;
  root: SVGGElement;
  anim: SVGGElement;
  shadow: SVGElement | null;
  box: FxTarget;
}

/**
 * Рендерит сцену страницы в SVG и проигрывает действия по тапу.
 * Ничего не знает о сказке: всё берётся из Scene (tale.json) и реестров спрайтов/анимаций/эффектов.
 *
 * Структура SVG:
 *   svg > g.cam (тряска камеры)
 *         ├ g.layer[data-depth]…   фон (параллакс)
 *         ├ g.world                 персонажи; у каждого: тень, g.anim (действия) > g.idle (дыхание) > спрайт
 *         ├ g.fx                    частицы
 *         └ g.layer[data-depth]…   передний план
 */
export class SceneView {
  private readonly svg: SVGSVGElement;
  private cam!: SVGGElement;
  private fx!: SVGGElement;
  private layers: { el: SVGGElement; depth: number }[] = [];
  private nodes = new Map<string, Node>();
  private scene: Scene | null = null;
  private busy = false;

  // параллакс: цель (от пальца/наклона) и текущее сглаженное значение
  private aim = { x: 0, y: 0 };
  private cur = { x: 0, y: 0 };
  private raf = 0;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly host: HTMLElement,
    private readonly sprites: SpriteRegistry,
    private readonly cb: SceneCallbacks,
  ) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 1000 700');
    this.svg.classList.add('scene');
    this.svg.addEventListener('pointerdown', (e) => this.handleTap(e));
    host.addEventListener('pointermove', (e) => this.aimAt(e));
    host.addEventListener('pointerleave', () => (this.aim = { x: 0, y: 0 }));
    window.addEventListener('deviceorientation', (e) => this.aimByTilt(e));
    host.appendChild(this.svg);
    this.fitAspect();
    new ResizeObserver(() => this.fitAspect()).observe(host);
    if (!this.reducedMotion) this.raf = requestAnimationFrame(this.tick);
  }

  /**
   * Снимок текущей сцены (для перелистывания). Состояния анимаций (например, вытянутая репка)
   * сначала фиксируются в inline-стилях, иначе клон показал бы исходные позиции.
   */
  snapshot(): SVGSVGElement {
    this.svg.getAnimations?.({ subtree: true }).filter(isScripted).forEach((a) => {
      try {
        a.commitStyles();
      } catch {
        /* элемент без стилей (например, уже удалённая частица) */
      }
    });
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    clone.querySelector('g.fx')?.replaceChildren();
    return clone;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  /**
   * Сцена никогда не обрезается по бокам (там персонажи):
   *  - широкая страница — заполняем (slice), лишнее срезаем сверху: низ с персонажами важнее неба;
   *  - высокая страница (портрет, большой экран) — вписываем по ширине и ставим по центру;
   *    сверху и снизу видно продолжение неба и земли из фона (svg.scene { overflow: visible }).
   */
  private fitAspect(): void {
    const wide = this.host.clientWidth / Math.max(1, this.host.clientHeight) >= 1000 / 700;
    this.svg.setAttribute('preserveAspectRatio', wide ? 'xMidYMax slice' : 'xMidYMid meet');
  }


  render(scene: Scene): void {
    this.scene = scene;
    this.busy = false;
    this.nodes.clear();
    this.svg.getAnimations?.({ subtree: true }).filter(isScripted).forEach((a) => a.cancel());

    const front = `${scene.background}-front`;
    const sorted = [...scene.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    const elements = sorted.map((el, i) => {
      const s = el.scale ?? 1;
      const cls = ['el', el.onTap ? 'tappable' : '', el.state ? `state-${el.state}` : ''].join(' ');
      // случайные фазы, чтобы герои дышали и моргали не синхронно
      const style = `--d:${(-i * 0.7 - Math.random()).toFixed(2)}s;--blink:${(3.6 + Math.random() * 2.4).toFixed(2)}s`;
      return (
        `<g class="${cls}" data-id="${el.id}" data-sprite="${el.sprite}" style="${style}" transform="translate(${el.x} ${el.y}) scale(${s})">` +
        `<rect class="hit" fill="transparent"/><ellipse class="shadow" fill="url(#shadow)"/>` +
        `<g class="anim"><g class="idle">${this.sprites.markup(el.sprite)}</g></g></g>`
      );
    });

    this.svg.innerHTML =
      (this.sprites.has('defs') ? this.sprites.markup('defs') : '') +
      `<g class="cam">` +
      this.sprites.markup(scene.background) +
      `<g class="world">${elements.join('')}</g>` +
      `<g class="fx"></g>` +
      (this.sprites.has(front) ? this.sprites.markup(front) : '') +
      `</g>`;

    this.cam = this.svg.querySelector('g.cam')!;
    this.fx = this.svg.querySelector('g.fx')!;
    const world = this.svg.querySelector<SVGGElement>('g.world')!;
    world.dataset.depth = String(WORLD_DEPTH);
    this.fx.dataset.depth = String(WORLD_DEPTH);
    this.layers = [...this.svg.querySelectorAll<SVGGElement>('.layer, g.world, g.fx')].map((el) => ({
      el,
      depth: Number(el.dataset.depth ?? 0),
    }));

    this.svg.querySelectorAll<SVGGElement>('g.el').forEach((root) => {
      const def = scene.elements.find((e) => e.id === root.dataset.id)!;
      const anim = root.querySelector<SVGGElement>('g.anim')!;
      const shadow = root.querySelector<SVGElement>('ellipse.shadow');
      const box = this.layout(def, root, anim, shadow);
      this.nodes.set(def.id, { def, root, anim, shadow, box });
    });
    this.applyParallax();
  }

  /** хит-бокс крупнее спрайта, тень по ширине спрайта, габариты для эффектов */
  private layout(def: SceneElement, root: SVGGElement, anim: SVGGElement, shadow: SVGElement | null): FxTarget {
    const s = def.scale ?? 1;
    let b: DOMRect;
    try {
      b = anim.getBBox();
    } catch {
      return { x: def.x, y: def.y, width: 100 * s, height: 200 * s };
    }
    const hit = root.querySelector<SVGRectElement>('rect.hit')!;
    const pad = HIT_PADDING / s;
    hit.setAttribute('x', String(b.x - pad));
    hit.setAttribute('y', String(b.y - pad));
    hit.setAttribute('width', String(b.width + pad * 2));
    hit.setAttribute('height', String(b.height + pad * 2));
    if (shadow) {
      const rx = Math.min(b.width * 0.5, 70);
      shadow.setAttribute('cx', String(b.x + b.width / 2 - (def.sprite === 'repka' ? 0 : 4)));
      shadow.setAttribute('cy', '0');
      shadow.setAttribute('rx', String(rx));
      shadow.setAttribute('ry', String(rx * 0.2));
    }
    // для частиц важна видимая часть над землёй
    return { x: def.x, y: def.y, width: b.width * s, height: Math.min(-b.y, b.height) * s };
  }

  private handleTap(e: PointerEvent): void {
    const p = this.toScene(e.clientX, e.clientY);
    if (p && !this.reducedMotion) ripple(this.fx, p.x, p.y);
    const target = (e.target as Element).closest<SVGGElement>('g.el.tappable');
    if (!target || !this.scene) return;
    const id = target.dataset.id!;
    const def = this.scene.elements.find((x) => x.id === id);
    this.cb.onTap?.(id);
    if (def?.onTap) this.runAction(def.onTap);
  }

  /**
   * Куда показать подсказку «нажми на героя»: первый интерактивный элемент страницы,
   * чуть выше середины его фигуры. Координаты окна; null — на странице нечего нажимать.
   */
  hintPoint(): { x: number; y: number } | null {
    const stage = this.host.getBoundingClientRect();
    for (const n of this.nodes.values()) {
      if (!n.def.onTap) continue;
      const r = n.anim.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const x = r.left + r.width / 2;
      const y = r.top + r.height * 0.42;
      // фигура может быть частично срезана краем сцены
      return {
        x: Math.min(Math.max(x, stage.left + 24), stage.right - 24),
        y: Math.min(Math.max(y, stage.top + 24), stage.bottom - 24),
      };
    }
    return null;
  }

  /** координаты экрана → координаты слоя частиц */
  private toScene(x: number, y: number): DOMPoint | null {
    const m = this.fx?.getScreenCTM();
    if (!m) return null;
    return new DOMPoint(x, y).matrixTransform(m.inverse());
  }

  /** Запуск действия по имени. Публичный — его же может вызвать нативный слой. */
  runAction(actionId: string): void {
    const calls = this.scene?.actions?.[actionId];
    if (!calls || this.busy) return;
    this.busy = true;

    // сбрасываем «застывшие» анимации (fill: forwards) у всех участников — действие начинается с чистого листа
    const touched = new Set(calls.flatMap((c) => this.resolve(c.target)));
    touched.forEach((id) => {
      const n = this.nodes.get(id);
      n?.root.getAnimations({ subtree: true }).filter(isScripted).forEach((a) => a.cancel());
    });

    const running: Promise<unknown>[] = [];
    for (const call of calls) running.push(...this.play(call));
    Promise.allSettled(running).then(() => {
      this.busy = false;
    });
  }

  private play(call: AnimationCall): Promise<unknown>[] {
    const ids = this.resolve(call.target);
    const delay = call.delayMs ?? 0;
    const out: Promise<unknown>[] = [];
    if (call.sfx) setTimeout(() => this.cb.onSfx(call.sfx!), delay);

    if (call.animation) {
      const factory = getAnimation(call.animation);
      ids.forEach((id, index) => {
        const n = this.nodes.get(id);
        if (!n) return;
        const ctx = { el: n.anim, root: n.root, shadow: n.shadow, index, count: ids.length };
        factory(ctx, delay + index * (call.staggerMs ?? 0)).forEach((a) => out.push(a.finished));
      });
    }

    if (call.fx && !this.reducedMotion) {
      const effect = getEffect(call.fx);
      // эффект — один на цель; для группы берём её первый элемент
      const n = this.nodes.get(ids[0]);
      const target = n?.box ?? { x: 500, y: 560, width: 200, height: 200 };
      effect({ layer: this.fx, camera: this.cam, target, delayMs: delay }).forEach((a) => out.push(a.finished));
    }
    return out;
  }

  /** target — это id элемента или имя группы */
  private resolve(target: string): string[] {
    return this.scene?.groups?.[target] ?? [target];
  }

  /* ---------------- параллакс ---------------- */

  private aimAt(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return; // на тач-экране палец занят тапами — там работает наклон
    const r = this.host.getBoundingClientRect();
    this.aim = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
  }

  private aimByTilt(e: DeviceOrientationEvent): void {
    if (e.gamma == null || e.beta == null) return;
    const landscape = window.innerWidth > window.innerHeight;
    const x = landscape ? e.beta : e.gamma;
    const y = landscape ? -e.gamma : e.beta - 45;
    this.aim = { x: Math.max(-1, Math.min(1, x / 20)), y: Math.max(-1, Math.min(1, y / 25)) };
  }

  private tick = (t: number): void => {
    // лёгкое «дыхание» камеры, даже когда никто не трогает экран
    const idleX = Math.sin(t / 4200) * 0.25;
    const idleY = Math.cos(t / 5300) * 0.15;
    this.cur.x += (this.aim.x + idleX - this.cur.x) * 0.06;
    this.cur.y += (this.aim.y + idleY - this.cur.y) * 0.06;
    this.applyParallax();
    this.raf = requestAnimationFrame(this.tick);
  };

  private applyParallax(): void {
    for (const { el, depth } of this.layers) {
      const dx = -this.cur.x * depth * PARALLAX_RANGE;
      const dy = -this.cur.y * depth * PARALLAX_RANGE * 0.4;
      el.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    }
  }
}

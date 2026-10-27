/**
 * Эффекты сцены: частицы и движение камеры. Имена используются в tale.json (поле fx).
 * Частицы создаются на время эффекта в слое .fx и удаляются по окончании.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface FxTarget {
  /** точка опоры элемента (низ по центру), в координатах сцены */
  x: number;
  y: number;
  /** габариты спрайта в координатах сцены */
  width: number;
  height: number;
}

export interface FxContext {
  layer: SVGGElement;
  camera: SVGGElement;
  target: FxTarget;
  delayMs: number;
}

export type Effect = (ctx: FxContext) => Animation[];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function spawn(layer: SVGGElement, tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  layer.appendChild(el);
  return el;
}

/** частица живёт ровно столько, сколько её анимация */
function fly(el: SVGElement, frames: Keyframe[], o: KeyframeAnimationOptions): Animation {
  el.style.transformBox = 'fill-box';
  el.style.transformOrigin = '50% 50%';
  el.style.opacity = '0';
  const a = el.animate(frames, { fill: 'forwards', ...o });
  a.finished.finally(() => el.remove()).catch(() => {});
  return a;
}

/** четырёхлучевая звёздочка с центром в (x,y). Координаты — в самом пути: transform-атрибут перебила бы CSS-анимация */
const star = (r: number, x: number, y: number) => {
  const p = r * 0.32;
  const pt = (dx: number, dy: number) => `${x + dx} ${y + dy}`;
  return `M${pt(0, -r)} Q${pt(p, -p)} ${pt(r, 0)} Q${pt(p, p)} ${pt(0, r)} Q${pt(-p, p)} ${pt(-r, 0)} Q${pt(-p, -p)} ${pt(0, -r)}Z`;
};

const registry: Record<string, Effect> = {
  /** облачка пыли у основания — когда тянут и упираются */
  dust: ({ layer, target, delayMs }) =>
    Array.from({ length: 7 }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const r = rnd(10, 20);
      const el = spawn(layer, 'circle', { cx: target.x + side * rnd(10, target.width * 0.4), cy: target.y - 4, r, fill: '#f7e3c4' });
      const dx = side * rnd(20, 60);
      return fly(
        el,
        [
          { transform: 'translate(0,0) scale(.3)', opacity: 0 },
          { transform: `translate(${dx * 0.4}px,-10px) scale(.9)`, opacity: 0.9, offset: 0.25 },
          { transform: `translate(${dx}px,-34px) scale(1.4)`, opacity: 0 },
        ],
        { duration: rnd(700, 1100), delay: delayMs + i * 60, easing: 'ease-out' },
      );
    }),

  /** искорки вокруг макушки — рост, чудо */
  sparkle: ({ layer, target, delayMs }) =>
    Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      const cx = target.x + Math.cos(a) * target.width * 0.55;
      const cy = target.y - target.height * 0.55 + Math.sin(a) * target.height * 0.4;
      const el = spawn(layer, 'path', { d: star(rnd(9, 16), cx, cy), fill: i % 3 ? '#fff6b0' : '#ffffff' });
      return fly(
        el,
        [
          { transform: 'scale(0) rotate(0deg)', opacity: 0 },
          { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.4 },
          { transform: 'scale(0) rotate(120deg)', opacity: 0 },
        ],
        { duration: 900, delay: delayMs + i * 70, easing: 'ease-out' },
      );
    }),

  /** земля разлетается + звёздочки + кольцо — репка выскочила */
  burst: ({ layer, target, delayMs }) => {
    const out: Animation[] = [];
    const ring = spawn(layer, 'ellipse', { cx: target.x, cy: target.y - 6, rx: 40, ry: 12, fill: 'none', stroke: '#fff', 'stroke-width': 6 });
    out.push(
      fly(
        ring,
        [
          { transform: 'scale(.4)', opacity: 0.9 },
          { transform: 'scale(3)', opacity: 0 },
        ],
        { duration: 700, delay: delayMs, easing: 'ease-out' },
      ),
    );
    for (let i = 0; i < 14; i++) {
      const el = spawn(layer, 'circle', { cx: target.x + rnd(-30, 30), cy: target.y - 6, r: rnd(5, 11), fill: i % 3 ? '#c58f58' : '#a8763f' });
      const dx = rnd(-170, 170);
      const up = rnd(90, 210);
      out.push(
        fly(
          el,
          [
            { transform: 'translate(0,0)', opacity: 1 },
            { transform: `translate(${dx * 0.5}px,${-up}px)`, opacity: 1, offset: 0.45, easing: 'ease-in' },
            { transform: `translate(${dx}px,${rnd(-10, 30)}px)`, opacity: 0 },
          ],
          { duration: rnd(800, 1100), delay: delayMs, easing: 'ease-out' },
        ),
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + rnd(-1.1, 1.1);
      const dist = rnd(120, 220);
      const el = spawn(layer, 'path', { d: star(rnd(10, 18), target.x, target.y - 80), fill: i % 2 ? '#ffe066' : '#fff' });
      out.push(
        fly(
          el,
          [
            { transform: 'translate(0,0) scale(0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${Math.cos(a) * dist * 0.7}px,${Math.sin(a) * dist * 0.7}px) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px) scale(0) rotate(160deg)`, opacity: 0 },
          ],
          { duration: 1100, delay: delayMs + 120, easing: 'cubic-bezier(.2,.8,.3,1)' },
        ),
      );
    }
    return out;
  },

  /** конфетти на всю сцену — праздник */
  confetti: ({ layer, delayMs }) => {
    const colors = ['#ff6b6b', '#ffc94d', '#5cc0e0', '#7cc263', '#f590b2', '#a98bea'];
    return Array.from({ length: 46 }, (_, i) => {
      const x = rnd(40, 960);
      const el = spawn(layer, 'rect', { x, y: -30, width: rnd(10, 16), height: rnd(6, 10), rx: 2, fill: colors[i % colors.length] });
      const drift = rnd(-80, 80);
      const spin = rnd(360, 900);
      return fly(
        el,
        [
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${drift * 0.5}px,360px) rotate(${spin * 0.5}deg) scaleX(.3)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${drift}px,720px) rotate(${spin}deg) scaleX(1)`, opacity: 0.9 },
        ],
        { duration: rnd(1800, 2800), delay: delayMs + rnd(0, 600), easing: 'cubic-bezier(.3,.1,.6,1)' },
      );
    });
  },

  /** тряска камеры */
  shake: ({ camera, delayMs }) => [
    camera.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: 'translate(-7px,4px) rotate(-.4deg)' },
        { transform: 'translate(6px,-3px) rotate(.3deg)' },
        { transform: 'translate(-4px,2px) rotate(-.2deg)' },
        { transform: 'translate(2px,-1px)' },
        { transform: 'translate(0,0) rotate(0deg)' },
      ],
      { duration: 420, delay: delayMs, easing: 'ease-out' },
    ),
  ],
};

/** волна от пальца — отклик на любой тап по сцене */
export function ripple(layer: SVGGElement, x: number, y: number): void {
  const el = spawn(layer, 'circle', { cx: x, cy: y, r: 26, fill: 'none', stroke: '#fff', 'stroke-width': 6 });
  fly(
    el,
    [
      { transform: 'scale(.3)', opacity: 0.9 },
      { transform: 'scale(1.6)', opacity: 0 },
    ],
    { duration: 520, easing: 'ease-out' },
  );
}

export function getEffect(name: string): Effect {
  const f = registry[name];
  if (!f) throw new Error(`Эффект не найден: ${name}`);
  return f;
}

export function hasEffect(name: string): boolean {
  return name in registry;
}

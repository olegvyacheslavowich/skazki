/**
 * Реестр анимаций персонажей. Имена используются в tale.json → движок не содержит логики конкретной сказки.
 * Анимации — Web Animations API. Каждая анимация двигает не только «тело» (.anim), но и части:
 * руки (.arm), ботву (.leaves) и тень на земле — так появляется вес, растяжение и инерция
 * (squash & stretch, follow-through).
 *
 * Точки трансформации — в CSS (transform-box: fill-box): тело — низ по центру, рука — плечо,
 * ботва — основание, тень — центр.
 *
 * Когда появятся Rive-файлы, сюда добавится фабрика, которая вместо keyframes дёргает
 * input у state machine (например, trigger "pull"), а tale.json останется прежним.
 */

export interface AnimContext {
  /** <g class="anim"> внутри спрайта */
  el: SVGGElement;
  /** корневой <g> элемента сцены (на нём висят state-классы) */
  root: SVGGElement;
  /** тень элемента на земле */
  shadow: SVGElement | null;
  /** позиция элемента в группе и размер группы */
  index: number;
  count: number;
}

export type AnimationFactory = (ctx: AnimContext, delayMs: number) => Animation[];

const opts = (duration: number, delay: number, extra: KeyframeAnimationOptions = {}): KeyframeAnimationOptions => ({
  duration,
  delay,
  easing: 'ease-in-out',
  ...extra,
});

/** анимировать все найденные части */
function parts(root: Element, selector: string, frames: Keyframe[], o: KeyframeAnimationOptions): Animation[] {
  return [...root.querySelectorAll(selector)].map((p) => p.animate(frames, o));
}

function onShadow(ctx: AnimContext, frames: Keyframe[], o: KeyframeAnimationOptions): Animation[] {
  return ctx.shadow ? [ctx.shadow.animate(frames, o)] : [];
}

const registry: Record<string, AnimationFactory> = {
  /** тянут-потянут — и возвращаются: «вытянуть не могут» */
  pullFail: (ctx, d) => {
    const o = opts(1600, d);
    return [
      ctx.el.animate(
        [
          { transform: 'translateX(0) rotate(0deg) scale(1, 1)' },
          { transform: 'translateX(4px) rotate(2deg) scale(1.03, .95)', offset: 0.1 },
          { transform: 'translateX(-18px) rotate(-10deg) scale(.98, 1.03)', offset: 0.3 },
          { transform: 'translateX(-8px) rotate(-4deg) scale(1.02, .97)', offset: 0.48 },
          { transform: 'translateX(-22px) rotate(-12deg) scale(.97, 1.04)', offset: 0.68 },
          { transform: 'translateX(-2px) rotate(1deg) scale(1.03, .96)', offset: 0.88 },
          { transform: 'translateX(0) rotate(0deg) scale(1, 1)' },
        ],
        o,
      ),
      ...parts(
        ctx.el,
        '.arm',
        [
          { transform: 'scaleX(1) rotate(0deg)' },
          { transform: 'scaleX(1.16) rotate(4deg)', offset: 0.3 },
          { transform: 'scaleX(1.06) rotate(1deg)', offset: 0.48 },
          { transform: 'scaleX(1.2) rotate(5deg)', offset: 0.68 },
          { transform: 'scaleX(1) rotate(0deg)' },
        ],
        o,
      ),
      ...onShadow(
        ctx,
        [
          { transform: 'translateX(0) scaleX(1)' },
          { transform: 'translateX(-14px) scaleX(1.12)', offset: 0.3 },
          { transform: 'translateX(-6px) scaleX(1.04)', offset: 0.48 },
          { transform: 'translateX(-16px) scaleX(1.14)', offset: 0.68 },
          { transform: 'translateX(0) scaleX(1)' },
        ],
        o,
      ),
    ];
  },

  /** то же усилие, но застывает перед финальным рывком */
  pullStrain: (ctx, d) => {
    const o = opts(1350, d, { fill: 'forwards' });
    return [
      ctx.el.animate(
        [
          { transform: 'translateX(0) rotate(0deg) scale(1, 1)' },
          { transform: 'translateX(4px) rotate(2deg) scale(1.03, .95)', offset: 0.12 },
          { transform: 'translateX(-18px) rotate(-10deg) scale(.98, 1.03)', offset: 0.4 },
          { transform: 'translateX(-8px) rotate(-4deg) scale(1.02, .97)', offset: 0.65 },
          { transform: 'translateX(-14px) rotate(-8deg) scale(1, 1)' },
        ],
        o,
      ),
      ...parts(ctx.el, '.arm', [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.16)', offset: 0.4 }, { transform: 'scaleX(1.12)' }], o),
      ...onShadow(ctx, [{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }], o),
    ];
  },

  /** вытянули! — все валятся назад, руки взлетают */
  pullSuccess: (ctx, d) => {
    const o = opts(1000, d, { fill: 'forwards', easing: 'cubic-bezier(.3,1.35,.55,1)' });
    const fall = -64 - ctx.index * 5;
    return [
      ctx.el.animate(
        [
          { transform: 'translateX(-14px) rotate(-8deg) scale(1, 1)' },
          { transform: 'translateX(-34px) rotate(-18deg) scale(.96, 1.05)', offset: 0.3 },
          { transform: `translateX(${fall}px) translateY(4px) rotate(-26deg) scale(1.04, .96)`, offset: 0.75 },
          { transform: `translateX(${fall + 4}px) translateY(2px) rotate(-22deg) scale(1, 1)` },
        ],
        o,
      ),
      ...parts(ctx.el, '.arm', [{ transform: 'scaleX(1.12) rotate(0deg)' }, { transform: 'scaleX(1) rotate(-38deg)' }], o),
      ...onShadow(ctx, [{ transform: 'translateX(-12px)' }, { transform: `translateX(${fall - 20}px) scaleX(1.3)` }], o),
    ];
  },

  /** репка упирается: качается, ботву вытягивает вверх */
  resist: (ctx, d) => {
    const o = opts(1400, d);
    return [
      ctx.el.animate(
        [
          { transform: 'rotate(0deg) scale(1, 1)' },
          { transform: 'rotate(-6deg) scale(.97, 1.05)', offset: 0.25 },
          { transform: 'rotate(2deg) scale(1.02, .98)', offset: 0.45 },
          { transform: 'rotate(-7deg) scale(.96, 1.06)', offset: 0.68 },
          { transform: 'rotate(1.5deg) scale(1.02, .98)', offset: 0.86 },
          { transform: 'rotate(0deg) scale(1, 1)' },
        ],
        o,
      ),
      ...parts(
        ctx.el,
        '.leaves',
        [
          { transform: 'scale(1, 1) rotate(0deg)' },
          { transform: 'scale(.92, 1.2) rotate(-8deg)', offset: 0.28 },
          { transform: 'scale(1.02, .96) rotate(3deg)', offset: 0.48 },
          { transform: 'scale(.9, 1.24) rotate(-10deg)', offset: 0.7 },
          { transform: 'scale(1.03, .97) rotate(4deg)', offset: 0.88 },
          { transform: 'scale(1, 1) rotate(0deg)' },
        ],
        opts(1400, d + 60),
      ),
    ];
  },

  /** репка вылетает из земли, переворачивается и «повисает» в руках */
  popOut: (ctx, d) => {
    const o = opts(1500, d, { fill: 'forwards', easing: 'cubic-bezier(.25,.85,.35,1)' });
    return [
      ctx.el.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scale(1, 1)' },
          { transform: 'translate(0, 6px) rotate(0deg) scale(1.1, .88)', offset: 0.1 },
          { transform: 'translate(-10px, -90px) rotate(-8deg) scale(.9, 1.14)', offset: 0.28 },
          { transform: 'translate(-34px, -236px) rotate(-20deg) scale(1, 1)', offset: 0.55 },
          { transform: 'translate(-52px, -136px) rotate(-8deg) scale(1.08, .92)', offset: 0.78 },
          { transform: 'translate(-50px, -150px) rotate(-11deg) scale(.98, 1.03)', offset: 0.9 },
          { transform: 'translate(-50px, -146px) rotate(-10deg) scale(1, 1)' },
        ],
        o,
      ),
      ...parts(
        ctx.el,
        '.leaves',
        [
          { transform: 'scale(1, 1) rotate(0deg)' },
          { transform: 'scale(.9, 1.2) rotate(6deg)', offset: 0.3 },
          { transform: 'scale(1.05, .9) rotate(-10deg)', offset: 0.6 },
          { transform: 'scale(1, 1.04) rotate(6deg)', offset: 0.82 },
          { transform: 'scale(1, 1) rotate(0deg)' },
        ],
        opts(1600, d + 80, { fill: 'forwards' }),
      ),
      ...onShadow(
        ctx,
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'translateX(-30px) scale(.45)', opacity: 0.35, offset: 0.55 },
          { transform: 'translateX(-50px) scale(.65)', opacity: 0.6 },
        ],
        o,
      ),
    ];
  },

  /** покачивание по тапу; ботва догоняет с опозданием */
  wobble: (ctx, d) => [
    ctx.el.animate(
      [
        { transform: 'rotate(0deg) scale(1, 1)' },
        { transform: 'rotate(0deg) scale(1.06, .94)', offset: 0.12 },
        { transform: 'rotate(-7deg) scale(.98, 1.03)', offset: 0.3 },
        { transform: 'rotate(6deg)', offset: 0.52 },
        { transform: 'rotate(-3deg)', offset: 0.74 },
        { transform: 'rotate(0deg) scale(1, 1)' },
      ],
      opts(1000, d),
    ),
    ...parts(
      ctx.el,
      '.leaves',
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(10deg)', offset: 0.35 },
        { transform: 'rotate(-9deg)', offset: 0.6 },
        { transform: 'rotate(4deg)', offset: 0.82 },
        { transform: 'rotate(0deg)' },
      ],
      opts(1200, d + 90),
    ),
  ],

  /** прыжок-радость: присел, взлетел, тень уменьшилась, приземлился с «плюхом» */
  hop: (ctx, d) => {
    const o = opts(850, d);
    return [
      ctx.el.animate(
        [
          { transform: 'translateY(0) scale(1, 1)' },
          { transform: 'translateY(0) scale(1.1, .86)', offset: 0.16 },
          { transform: 'translateY(-58px) scale(.92, 1.1)', offset: 0.42 },
          { transform: 'translateY(-64px) scale(1, 1)', offset: 0.5 },
          { transform: 'translateY(0) scale(1.12, .86)', offset: 0.8 },
          { transform: 'translateY(0) scale(.97, 1.03)', offset: 0.9 },
          { transform: 'translateY(0) scale(1, 1)' },
        ],
        o,
      ),
      ...parts(ctx.el, '.arm', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-50deg)', offset: 0.45 }, { transform: 'rotate(0deg)' }], o),
      // герои анфас: руки взлетают в стороны
      ...parts(ctx.el, '.arm-l', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(70deg)', offset: 0.45 }, { transform: 'rotate(0deg)' }], o),
      ...parts(ctx.el, '.arm-r', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-70deg)', offset: 0.45 }, { transform: 'rotate(0deg)' }], o),
      ...onShadow(
        ctx,
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.16 },
          { transform: 'scale(.6)', opacity: 0.45, offset: 0.48 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.8 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        o,
      ),
    ];
  },

  /** рост репки: из state "small" в полный размер; если уже выросла — просто качается */
  grow: (ctx, d) => {
    if (!ctx.root.classList.contains('state-small')) return registry.wobble(ctx, d);
    const o = opts(1600, d, { fill: 'forwards', easing: 'cubic-bezier(.3,1.2,.5,1)' });
    const body = ctx.el.animate(
      [
        { transform: 'scale(.32, .32)' },
        { transform: 'scale(.4, .26)', offset: 0.12 },
        { transform: 'scale(.62, .8)', offset: 0.42 },
        { transform: 'scale(1.16, .92)', offset: 0.7 },
        { transform: 'scale(.96, 1.05)', offset: 0.86 },
        { transform: 'scale(1, 1)' },
      ],
      o,
    );
    const leaves = parts(
      ctx.el,
      '.leaves',
      [
        { transform: 'scale(.6) rotate(-20deg)' },
        { transform: 'scale(1.15) rotate(8deg)', offset: 0.7 },
        { transform: 'scale(1) rotate(0deg)' },
      ],
      opts(1700, d + 100, { fill: 'forwards' }),
    );
    const shadow = onShadow(ctx, [{ transform: 'scale(.35)' }, { transform: 'scale(1)' }], o);
    const all = [body, ...leaves, ...shadow];
    body.finished
      .then(() => {
        ctx.root.classList.remove('state-small');
        all.forEach((a) => a.cancel());
      })
      .catch(() => {});
    return all;
  },
};

export function getAnimation(name: string): AnimationFactory {
  const f = registry[name];
  if (!f) throw new Error(`Анимация не найдена: ${name}`);
  return f;
}

export function hasAnimation(name: string): boolean {
  return name in registry;
}

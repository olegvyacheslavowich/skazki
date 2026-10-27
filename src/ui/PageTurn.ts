/**
 * Перелистывание как в настоящей книге.
 *
 * Корешок — правый край картинки (между картинкой и текстом). Лист вращается вокруг него в 3D:
 *  - вперёд: новый лист прилетает справа (со стороны текста) и ложится на старую картинку;
 *  - назад: текущий лист поднимается и уходит вправо, открывая предыдущую картинку.
 *
 * У листа две стороны: лицевая — картинка, оборотная — бумага. Пока лист поднят:
 *  - на нём бегут блик и тень (лист изгибается к свету и от него),
 *  - на странице под ним растёт/тает тень от листа,
 *  - сам лист чуть «прогибается» (scale/skew) — бумага не бывает идеально плоской.
 *
 * Работает на снимках SVG (cloneNode), живая сцена в это время уже отрисована под ними.
 */

const DURATION = 900;
const EASE = 'cubic-bezier(.45, .05, .25, 1)';

export class PageTurn {
  private running: { finish(): void } | null = null;

  constructor(private readonly stage: HTMLElement, private readonly reader: HTMLElement) {}

  /**
   * @param from снимок уходящей страницы
   * @param to   снимок новой страницы — нужен только при листании вперёд (он едет на листе)
   */
  turn(from: SVGSVGElement, to: SVGSVGElement | null, forward: boolean): void {
    this.running?.finish();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // в портрете картинка сверху, текст снизу — корешок горизонтальный, лист вращается вокруг нижнего края
    const vertical = matchMedia('(orientation: portrait)').matches;
    const layer = div(vertical ? 'turn vertical' : 'turn');
    const under = div('turn-under');
    const underShade = div('turn-under-shade');
    const leaf = div('turn-leaf');
    const front = div('turn-face leaf-front');
    const frontShade = div('turn-face-shade');
    const back = div('turn-face leaf-back');
    const backShade = div('turn-face-shade back');

    // вперёд: под листом остаётся старая картинка, на листе — новая
    // назад: под листом живая новая сцена (снимок не нужен), на листе — старая картинка
    if (forward) under.append(from, underShade);
    else under.append(underShade);
    front.append(forward && to ? to : from, frontShade);
    back.append(backShade);
    leaf.append(front, back);
    layer.append(under, leaf);
    [from, to].forEach((s) => s?.classList.add('snapshot'));
    this.stage.append(layer);
    this.reader.classList.add('turning');

    const o: KeyframeAnimationOptions = { duration: DURATION, easing: EASE, fill: 'forwards' };
    // лист: 180° = лежит на странице с текстом (оборотом вверх), 0° = лежит на картинке
    const leafFrames: Keyframe[] = vertical
      ? [
          { transform: 'rotateX(-180deg) scaleY(1) skewX(0deg)' },
          { transform: 'rotateX(-120deg) scaleY(.97) skewX(1.5deg)', offset: 0.3 },
          { transform: 'rotateX(-60deg) scaleY(.97) skewX(-1.5deg)', offset: 0.65 },
          { transform: 'rotateX(0deg) scaleY(1) skewX(0deg)' },
        ]
      : [
          { transform: 'rotateY(180deg) scaleX(1) skewY(0deg)' },
          { transform: 'rotateY(120deg) scaleX(.97) skewY(-1.5deg)', offset: 0.3 },
          { transform: 'rotateY(60deg) scaleX(.97) skewY(1.5deg)', offset: 0.65 },
          { transform: 'rotateY(0deg) scaleX(1) skewY(0deg)' },
        ];
    // блик/тень на листе: темнее всего, когда лист встаёт ребром к свету
    const faceShade: Keyframe[] = [{ opacity: 0 }, { opacity: 0.85, offset: 0.5 }, { opacity: 0 }];
    // тень от листа на странице под ним
    const coverShadow: Keyframe[] = [{ opacity: 0 }, { opacity: 0.15, offset: 0.4 }, { opacity: 0.55, offset: 0.9 }, { opacity: 0.6 }];

    const anims = [
      leaf.animate(forward ? leafFrames : [...leafFrames].reverse().map(flipOffset), o),
      frontShade.animate(faceShade, o),
      backShade.animate(faceShade, o),
      underShade.animate(forward ? coverShadow : [...coverShadow].reverse().map(flipOffset), o),
    ];

    const finish = () => {
      if (this.running !== handle) return;
      this.running = null;
      anims.forEach((a) => a.cancel());
      layer.remove();
      this.reader.classList.remove('turning');
    };
    const handle = { finish };
    this.running = handle;
    anims[0].finished.then(finish).catch(() => {});
  }
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

/** при развороте списка кадров смещения тоже нужно отразить */
function flipOffset(k: Keyframe): Keyframe {
  return typeof k.offset === 'number' ? { ...k, offset: 1 - k.offset } : k;
}

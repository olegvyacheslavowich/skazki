/**
 * Перелистывание как в настоящей книге — всегда по горизонтали, справа налево.
 *
 * Корешок — вертикальная линия:
 *  - альбом (картинка слева, текст справа) — между картинкой и текстом: это разворот книги;
 *  - портрет (картинка сверху, текст снизу) — левый край экрана: страница одна, лист — весь экран.
 *
 * Вперёд: правая страница приподнимается за правый край и переворачивается налево вокруг корешка,
 * открывая новый текст; на её обороте — новая картинка, она ложится на левую половину.
 * Назад — то же движение слева направо.
 *
 * Половины разворота разной ширины (62/38), поэтому лист собран из двух частей:
 * правая (0…90°) и левая (90…180°). На 90° лист стоит ребром к зрителю (перспектива
 * смотрит точно из корешка), и подмена одной части другой не видна.
 *
 * Пока лист в движении:
 *  - на нём темнеет блик (лист встаёт к свету ребром),
 *  - на странице под ним тень от листа: тает, когда он поднимается, и растёт, когда ложится,
 *  - свободный край чуть приподнят (skew) — бумага не бывает идеально жёсткой.
 *
 * Работает на снимках (SVG-сцена + клон страницы с текстом); живой экран под ними уже новый.
 */

const DURATION = 900;
const EASE = 'cubic-bezier(.45, .05, .25, 1)';
/** расстояние до зрителя — во столько раз больше самой широкой части листа */
const PERSPECTIVE = 2.5;

/** Снимок разворота: сцена и страница с текстом. */
export interface Spread {
  scene: SVGSVGElement;
  page: HTMLElement;
}

type Side = 'left' | 'right';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class PageTurn {
  private running: { finish(): void } | null = null;

  constructor(
    private readonly reader: HTMLElement,
    private readonly stage: HTMLElement,
    private readonly page: HTMLElement,
  ) {}

  /**
   * @param from снимок уходящего разворота
   * @param to   снимок нового разворота (живой экран уже показывает его)
   * @returns false, если анимации не было (prefers-reduced-motion)
   */
  turn(from: Spread, to: Spread, forward: boolean): boolean {
    this.running?.finish();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

    const r = this.reader.getBoundingClientRect();
    const stageBox = boxOf(this.stage, r);
    const pageBox = boxOf(this.page, r);
    // текст справа от картинки — разворот, корешок между ними; иначе страница одна, корешок у левого края
    const spine = pageBox.left >= stageBox.left + stageBox.width - 1 ? pageBox.left : 0;
    const twoPages = spine > 0;
    const region: Record<Side, Box> = {
      left: { left: 0, top: 0, width: spine, height: r.height },
      right: { left: spine, top: 0, width: r.width - spine, height: r.height },
    };
    const sideOf = (b: Box): Side => (b.left + b.width / 2 < spine ? 'left' : 'right');

    /** половина разворота: из снимка в неё попадает то, что лежит на этой половине экрана */
    const sheet = (cls: string, side: Side, shot: Spread | null): HTMLDivElement => {
      const el = div(`${cls} ${side}`);
      place(el, region[side]);
      if (shot) {
        const parts: [Box, () => HTMLElement][] = [
          [stageBox, () => this.stageShot(shot.scene)],
          [pageBox, () => shot.page],
        ];
        for (const [box, make] of parts) {
          if (sideOf(box) !== side) continue;
          const part = make();
          place(part, { ...box, left: box.left - region[side].left });
          el.append(part);
        }
      }
      el.append(div('turn-shade'));
      return el;
    };

    // вперёд: правый лист — уходящий текст, на его обороте (левый лист) — новая картинка;
    //         под левым листом до его приземления лежит старая картинка
    // назад:  левый лист — уходящая картинка, на обороте (правый лист) — прежний текст;
    //         под правым листом до приземления лежит уходящий текст
    const underL = sheet('turn-under', 'left', forward ? from : null);
    const underR = sheet('turn-under', 'right', forward ? null : from);
    const leafL = sheet('turn-leaf', 'left', forward ? to : from);
    const leafR = sheet('turn-leaf', 'right', forward ? from : to);

    const layer = div('turn');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.perspective = `${Math.round(Math.max(region.left.width, region.right.width) * PERSPECTIVE)}px`;
    layer.style.perspectiveOrigin = `${spine}px 45%`;
    if (twoPages) layer.append(underL, underR, leafL, leafR);
    else layer.append(underR, leafR);
    this.reader.append(layer);
    this.reader.classList.add('turning');

    // Кадры — для листания вперёд, p = 0…1. Лист: 0° — лежит справа, 180° — слева.
    // В развороте правая часть листа работает на p 0…½, левая — на ½…1.
    // Одна страница: левой части нет, правая уходит за левый край экрана к p = 0.8.
    const half = twoPages ? 0.5 : 0.8;
    const rightFrames: Keyframe[] = [
      { offset: 0, transform: rot(0, 0) },
      { offset: half / 2, transform: rot(-45, -1.5) },
      { offset: half, transform: rot(-90, -2) },
      { offset: 1, transform: rot(twoPages ? -90 : -90 / half, -2) },
    ];
    const leftFrames: Keyframe[] = [
      { offset: 0, transform: rot(90, 2) },
      { offset: half, transform: rot(90, 2) },
      { offset: 0.75, transform: rot(45, 1.5) },
      { offset: 1, transform: rot(0, 0) },
    ];
    // каждая часть видна только на своём отрезке
    const rightShown: Keyframe[] = [{ offset: 0, opacity: 1 }, { offset: half, opacity: 1 }, { offset: half, opacity: 0 }, { offset: 1, opacity: 0 }];
    const leftShown: Keyframe[] = [{ offset: 0, opacity: 0 }, { offset: half, opacity: 0 }, { offset: half, opacity: 1 }, { offset: 1, opacity: 1 }];
    // блик на листе: темнее всего, когда лист встаёт ребром
    const rightGloss: Keyframe[] = [{ offset: 0, opacity: 0 }, { offset: half, opacity: 0.85 }, { offset: 1, opacity: 0.85 }];
    const leftGloss: Keyframe[] = [{ offset: 0, opacity: 0.85 }, { offset: half, opacity: 0.85 }, { offset: 1, opacity: 0 }];
    // тень листа на странице: справа тает, пока лист поднимается; слева растёт, пока он ложится
    const rightShadow: Keyframe[] = [{ offset: 0, opacity: 0.55 }, { offset: half * 0.9, opacity: 0 }, { offset: 1, opacity: 0 }];
    const leftShadow: Keyframe[] = [{ offset: 0, opacity: 0 }, { offset: half, opacity: 0 }, { offset: 0.7, opacity: 0.15 }, { offset: 0.95, opacity: 0.55 }, { offset: 1, opacity: 0.6 }];

    const o: KeyframeAnimationOptions = { duration: DURATION, easing: EASE, fill: 'forwards' };
    // назад — те же кадры в обратном порядке, с тем же характером движения (подъём → взмах → посадка)
    const play = (el: Element, frames: Keyframe[]) => el.animate(forward ? frames : [...frames].reverse().map(flipOffset), o);
    const shade = (el: HTMLElement) => el.querySelector('.turn-shade')!;

    const anims = [
      play(leafR, rightFrames),
      play(leafR, rightShown),
      play(shade(leafR), rightGloss),
      play(shade(underR), rightShadow),
    ];
    if (twoPages) {
      anims.push(
        play(leafL, leftFrames),
        play(leafL, leftShown),
        play(shade(leafL), leftGloss),
        play(shade(underL), leftShadow),
      );
    }

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
    return true;
  }

  /** картинка со всем оформлением страницы (фон, рамка у корешка, свет и тень) */
  private stageShot(scene: SVGSVGElement): HTMLElement {
    const el = this.stage.cloneNode(false) as HTMLElement;
    el.removeAttribute('aria-label');
    el.append(scene);
    return el;
  }
}

function rot(deg: number, skew: number): string {
  return `rotateY(${deg}deg) skewY(${skew}deg)`;
}

function boxOf(el: Element, origin: DOMRect): Box {
  const b = el.getBoundingClientRect();
  return { left: b.left - origin.left, top: b.top - origin.top, width: b.width, height: b.height };
}

function place(el: HTMLElement, b: Box): void {
  Object.assign(el.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
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

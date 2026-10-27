/**
 * Реестр спрайтов. Каждый спрайт — SVG-разметка с началом координат в точке (0,0) = «низ по центру»
 * (ноги персонажа). Персонажи смотрят вправо, к репке.
 *
 * Стиль: «пластилиновый» объём без контуров. Каждая крупная форма рисуется дважды: цветом и
 * поверх — общим радиальным градиентом #vol (блик сверху-слева, тень снизу-справа). Градиенты
 * лежат в спрайте `defs`, который сцена вставляет один раз.
 *
 * Части, которые движок оживляет, помечены классами:
 *   .arm    — рука (вращается от плеча при «тянут»)
 *   .eyes   — глаза (моргание)
 *   .leaves — ботва репки (покачивание, вытягивание)
 *   .tail   — хвост (виляние)
 * Фон состоит из слоёв `.layer[data-depth]` для параллакса.
 *
 * Интерфейс SpriteRegistry позволяет позже подменить спрайты на Rive или растровые картинки.
 */

export interface SpriteRegistry {
  has(id: string): boolean;
  /** разметка содержимого спрайта (без внешнего <g>) */
  markup(id: string): string;
}

const C = {
  ink: '#3a3340',
  skin: '#ffd6b8',
  skinShade: '#f2b896',
  nose: '#ffab88',
  cheek: '#ff8a8a',
  white: '#fffaf2',
};

/** форма + объёмный оверлей */
const vol = (el: string, fill: string) => `<${el} fill="${fill}"/><${el} fill="url(#vol)"/>`;

const eye = (x: number, y: number, r = 5) => `
  <ellipse cx="${x}" cy="${y}" rx="${r * 0.85}" ry="${r * 1.15}" fill="${C.ink}"/>
  <circle cx="${x + r * 0.3}" cy="${y - r * 0.45}" r="${r * 0.38}" fill="#fff"/>
  <circle cx="${x - r * 0.3}" cy="${y + r * 0.4}" r="${r * 0.16}" fill="#fff" opacity=".8"/>`;

const eyes = (...pairs: [number, number, number?][]) =>
  `<g class="eyes">${pairs.map(([x, y, r]) => eye(x, y, r)).join('')}</g>`;

const cheek = (x: number, y: number, r = 8) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="${C.cheek}" opacity=".45"/>`;

const smile = (x: number, y: number, w = 10) =>
  `<path d="M${x - w / 2} ${y} Q${x} ${y + w * 0.6} ${x + w / 2} ${y}" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

/** рука от плеча (fx,fy) к ладони (tx,ty): рукав-капсула с объёмом + ладошка */
const arm = (fx: number, fy: number, tx: number, ty: number, sleeve: string, w = 20) => {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  // transform-атрибут — на внешней группе: CSS-анимация .arm перезаписала бы его
  return `<g transform="translate(${fx} ${fy}) rotate(${ang.toFixed(1)})"><g class="arm">
    ${vol(`rect x="${-w / 2}" y="${-w / 2}" width="${len}" height="${w}" rx="${w / 2}"`, sleeve)}
    ${vol(`circle cx="${len + 2}" cy="0" r="${w * 0.52}"`, C.skin)}
  </g></g>`;
};


/**
 * Опущенная рука для героя анфас: висит от плеча (sx,sy), чуть отведена от тела.
 * side: 'l' | 'r' — класс .arm-l / .arm-r, чтобы в прыжке руки взлетали в разные стороны.
 */
const armDown = (side: 'l' | 'r', sx: number, sy: number, len: number, sleeve: string, w = 20) => {
  const tilt = side === 'l' ? 9 : -9;
  return `<g transform="translate(${sx} ${sy}) rotate(${tilt})"><g class="arm-${side}">
    ${vol(`rect x="${-w / 2}" y="${-w / 2}" width="${w}" height="${len}" rx="${w / 2}"`, sleeve)}
    ${vol(`circle cx="0" cy="${len - w * 0.2}" r="${w * 0.55}"`, C.skin)}
  </g></g>`;
};

const SPRITES: Record<string, string> = {
  /* ---------------- общие градиенты ---------------- */
  defs: `
    <defs>
      <radialGradient id="vol" cx="34%" cy="26%" r="85%" fx="30%" fy="20%">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
        <stop offset=".32" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".62" stop-color="#2a1830" stop-opacity="0"/>
        <stop offset="1" stop-color="#2a1830" stop-opacity=".32"/>
      </radialGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fcdec"/>
        <stop offset=".7" stop-color="#dff2f4"/>
        <stop offset="1" stop-color="#fdf3dc"/>
      </linearGradient>
      <radialGradient id="sunGlow">
        <stop offset="0" stop-color="#fff6c8"/>
        <stop offset=".45" stop-color="#ffe58f"/>
        <stop offset=".46" stop-color="#ffe58f" stop-opacity=".45"/>
        <stop offset="1" stop-color="#ffe58f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#cde9b0"/><stop offset="1" stop-color="#b5dc98"/>
      </linearGradient>
      <linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a6d983"/><stop offset="1" stop-color="#82c466"/>
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f0c88f"/><stop offset="1" stop-color="#d9a86d"/>
      </linearGradient>
      <radialGradient id="shadow">
        <stop offset="0" stop-color="#5a3a22" stop-opacity=".32"/>
        <stop offset="1" stop-color="#5a3a22" stop-opacity="0"/>
      </radialGradient>
    </defs>`,

  /* ---------------- фон: слои для параллакса ----------------
   * Небо и земля продолжаются далеко за viewBox (сплошным цветом края градиента): на высоком экране
   * сцена стоит по центру, и сверху/снизу видно продолжение неба и земли, а не пустой фон. */
  field: `
    <g class="layer" data-depth="0.05">
      <rect x="-60" y="-1040" width="1120" height="1010" fill="#8fcdec"/>
      <rect x="-60" y="-40" width="1120" height="780" fill="url(#sky)"/>
      <g class="sun"><circle cx="850" cy="115" r="110" fill="url(#sunGlow)"/></g>
    </g>
    <g class="layer" data-depth="0.12"><g class="clouds">
      <path d="M140 140 a28 28 0 0 1 40 -30 a38 38 0 0 1 70 4 a26 26 0 0 1 22 26 Z" fill="#fff"/>
      <path d="M150 140 h120 a12 6 0 0 1 0 6 h-120Z" fill="#dbeef6"/>
      <path d="M500 92 a20 20 0 0 1 30 -22 a30 30 0 0 1 54 4 a20 20 0 0 1 16 18 Z" fill="#fff" opacity=".9"/>
    </g></g>
    <g class="layer" data-depth="0.2">
      <path d="M-60 440 C120 360 250 380 360 430 C470 470 560 400 700 380 C820 365 920 400 1060 430 V720 H-60Z" fill="url(#hillFar)"/>
      <g transform="translate(240 0)" opacity=".85">
        <rect x="-4" y="388" width="8" height="40" rx="4" fill="#b58c68"/>
        ${vol('circle cx="0" cy="378" r="28"', '#7cc477')}
        <rect x="44" y="404" width="7" height="30" rx="3.5" fill="#b58c68"/>
        ${vol('circle cx="47" cy="398" r="20"', '#68b766')}
      </g>
    </g>
    <g class="layer" data-depth="0.35">
      <path d="M-60 485 C140 430 300 455 440 488 C580 520 720 455 860 450 C930 448 980 462 1060 470 V720 H-60Z" fill="url(#hillNear)"/>
      <g transform="translate(64 400)">
        <ellipse cx="60" cy="130" rx="76" ry="8" fill="url(#shadow)"/>
        ${vol('rect x="0" y="44" width="118" height="84" rx="10"', '#f3b47c')}
        <path d="M0 56 H118" stroke="#e09d64" stroke-width="4"/>
        ${vol('path d="M-14 50 Q-10 40 0 34 L50 0 Q59 -6 68 0 L118 34 Q128 40 132 50 Z"', '#ea6f58')}
        ${vol('rect x="40" y="70" width="38" height="34" rx="8"', '#fff1c4')}
        <path d="M59 70 V104 M40 87 H78" stroke="#f3b47c" stroke-width="4"/>
        ${vol('rect x="92" y="10" width="14" height="28" rx="3"', '#c95c49')}
      </g>
    </g>
    <g class="layer" data-depth="0.6">
      <rect x="-60" y="540" width="1120" height="200" fill="url(#ground)"/>
      <rect x="-60" y="739" width="1120" height="1000" fill="#d9a86d"/>
      <path d="M-60 540 Q250 526 500 541 T1060 537 V558 Q500 566 -60 556Z" fill="#7cc263"/>
      <g fill="#d8a56a" opacity=".8">
        <rect x="40" y="596" width="300" height="12" rx="6"/><rect x="420" y="606" width="260" height="12" rx="6"/>
        <rect x="120" y="648" width="380" height="12" rx="6"/><rect x="600" y="656" width="360" height="12" rx="6"/>
      </g>
      <g fill="#6db857" class="sprouts">
        <path d="M70 598 q-6 -18 6 -26 q4 16 -6 26Z"/><path d="M200 598 q-6 -18 6 -26 q4 16 -6 26Z"/>
        <path d="M470 608 q-6 -18 6 -26 q4 16 -6 26Z"/><path d="M640 608 q-6 -18 6 -26 q4 16 -6 26Z"/>
        <path d="M260 650 q-6 -18 6 -26 q4 16 -6 26Z"/><path d="M880 658 q-6 -18 6 -26 q4 16 -6 26Z"/>
      </g>
    </g>`,

  /** передний план: грядка-холмик, закрывающий низ репки */
  'field-front': `
    <defs>
      <linearGradient id="moundFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ecc287"/>
        <stop offset=".78" stop-color="#e4b77d"/>
        <stop offset="1" stop-color="#e1b37a" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- глубина как у персонажей (0.8), чтобы грядка не «уезжала» от репки при параллаксе -->
    <g class="layer" data-depth="0.8">
      <path d="M688 684 Q700 610 718 584 Q730 562 760 556 Q792 540 826 543 Q866 537 898 553 Q922 562 934 584 Q950 610 962 684Z" fill="url(#moundFade)"/>
      <path d="M718 584 Q730 562 760 556 Q792 540 826 543 Q866 537 898 553 Q922 562 934 584 Q900 572 866 576 Q826 566 790 574 Q748 570 718 584Z" fill="#c58f58"/>
      <path d="M722 588 Q770 576 820 590 Q870 600 930 588" stroke="#fff" stroke-opacity=".22" stroke-width="5" fill="none" stroke-linecap="round"/>
      <g fill="#d39f66"><ellipse cx="772" cy="606" rx="14" ry="4"/><ellipse cx="866" cy="612" rx="18" ry="4.5"/></g>
    </g>`,

  /* ---------------- репка ---------------- */
  repka: `
    <g class="leaves">
      ${vol('path d="M-4 -148 C-30 -180 -62 -210 -60 -248 C-58 -262 -40 -262 -32 -250 C-18 -224 -10 -186 -2 -150Z"', '#5bb85e')}
      <path d="M-46 -240 C-36 -216 -20 -184 -6 -152" stroke="#9be08e" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${vol('path d="M0 -150 C-6 -196 0 -246 22 -276 C32 -288 50 -280 48 -264 C40 -228 22 -186 6 -150Z"', '#46a352')}
      <path d="M36 -268 C24 -236 12 -192 3 -152" stroke="#84d27a" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${vol('path d="M6 -148 C26 -182 54 -208 84 -212 C98 -214 104 -200 94 -190 C70 -170 40 -156 10 -144Z"', '#70c766')}
    </g>
    ${vol('path d="M0 -150 C-82 -150 -114 -86 -102 -34 C-90 14 -40 34 0 52 C40 34 90 14 102 -34 C114 -86 82 -150 0 -150Z"', '#ffcb3a')}
    <path d="M44 -136 C86 -112 100 -68 92 -30 C84 6 44 30 0 52 C36 24 62 -6 68 -46 C72 -84 62 -116 44 -136Z" fill="#f0a826" opacity=".7"/>
    <ellipse cx="-58" cy="-92" rx="12" ry="30" transform="rotate(20 -58 -92)" fill="#fff6c2" opacity=".85"/>
    <circle cx="-40" cy="-126" r="6" fill="#fff" opacity=".9"/>
    <path d="M0 50 Q4 64 -2 78" stroke="#e09d22" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${eyes([-22, -74, 6.5], [22, -74, 6.5])}
    ${cheek(-44, -50, 12)}${cheek(44, -50, 12)}
    ${smile(0, -52, 16)}`,

  /* ---------------- дед ---------------- */
  ded: `
    ${vol('rect x="-26" y="-74" width="20" height="66" rx="10"', '#5079b3')}
    ${vol('rect x="6" y="-74" width="20" height="66" rx="10"', '#5079b3')}
    ${vol('ellipse cx="-14" cy="-6" rx="17" ry="9"', '#6a4a3a')}
    ${vol('ellipse cx="20" cy="-6" rx="17" ry="9"', '#6a4a3a')}
    ${vol('path d="M-44 -66 Q-48 -140 -10 -150 H10 Q46 -140 44 -66 Q0 -54 -44 -66Z"', '#ee6b52')}
    ${vol('rect x="-45" y="-86" width="90" height="12" rx="6"', '#ffc94d')}
    ${arm(20, -124, 84, -150, '#ee6b52')}
    ${vol('circle cx="0" cy="-194" r="46"', C.skin)}
    ${vol('path d="M-40 -196 Q-46 -236 0 -244 Q46 -238 46 -200 Q42 -224 0 -228 Q-30 -226 -40 -196Z"', '#e2e6ee')}
    ${vol('path d="M-34 -222 Q-30 -254 6 -254 Q40 -252 44 -224 Q20 -232 -34 -222Z"', '#5c80b0')}
    ${vol('path d="M36 -228 Q60 -228 64 -220 Q50 -214 38 -220Z"', '#4a6c99')}
    ${vol('path d="M-30 -180 Q-34 -130 6 -116 Q46 -132 42 -180 Q30 -164 6 -166 Q-16 -164 -30 -180Z"', C.white)}
    ${vol('path d="M6 -176 Q20 -188 40 -174 Q24 -166 6 -172Z"', C.white)}
    <path d="M6 -214 q8 -6 16 0 M28 -214 q7 -5 14 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${eyes([14, -200, 5], [34, -200, 5])}
    ${vol('circle cx="44" cy="-184" r="9"', C.nose)}
    ${cheek(-4, -184, 9)}`,

  /* ---------------- бабка ---------------- */
  babka: `
    ${vol('ellipse cx="-12" cy="-6" rx="15" ry="8"', '#6a4a3a')}
    ${vol('ellipse cx="16" cy="-6" rx="15" ry="8"', '#6a4a3a')}
    ${vol('path d="M-54 -8 Q-40 -110 -24 -138 Q0 -150 24 -138 Q42 -110 56 -8 Q0 4 -54 -8Z"', '#5cb080')}
    <path d="M-10 -128 Q6 -132 20 -128 Q30 -70 34 -6 Q8 0 -14 -4 Q-14 -70 -10 -128Z" fill="#fff4dc"/>
    <g fill="#ffb3a7"><circle cx="8" cy="-100" r="4"/><circle cx="14" cy="-62" r="4"/><circle cx="6" cy="-26" r="4"/></g>
    <path d="M-54 -8 Q0 4 56 -8 L54 -20 Q0 -8 -52 -20Z" fill="#ffc94d"/>
    ${arm(18, -118, 88, -126, '#fbe3c4')}
    ${vol('circle cx="0" cy="-174" r="42"', C.skin)}
    ${vol('path d="M-50 -170 Q-56 -232 0 -234 Q56 -232 50 -174 Q46 -150 30 -140 Q40 -170 34 -186 Q20 -206 0 -206 Q-22 -206 -34 -186 Q-40 -168 -32 -140 Q-46 -150 -50 -170Z"', '#f05c5c')}
    ${vol('path d="M-36 -146 L-58 -128 Q-48 -122 -40 -126 L-30 -140Z"', '#d94a4a')}
    <g fill="#fff" opacity=".92">
      <circle cx="-30" cy="-210" r="4"/><circle cx="-8" cy="-222" r="4"/><circle cx="16" cy="-220" r="4"/>
      <circle cx="36" cy="-204" r="4"/><circle cx="-42" cy="-178" r="3.5"/><circle cx="44" cy="-176" r="3.5"/>
    </g>
    <path d="M-26 -194 Q0 -208 26 -192 Q14 -198 0 -198 Q-14 -198 -26 -194Z" fill="#cdcdd6"/>
    ${eyes([10, -176, 4.6], [28, -176, 4.6])}
    ${vol('circle cx="36" cy="-164" r="7"', C.nose)}
    ${cheek(4, -158, 8)}${smile(22, -152, 12)}`,

  /* ---------------- внучка ---------------- */
  vnuchka: `
    ${vol('rect x="-16" y="-32" width="10" height="26" rx="5"', C.skin)}
    ${vol('rect x="6" y="-32" width="10" height="26" rx="5"', C.skin)}
    ${vol('ellipse cx="-10" cy="-6" rx="12" ry="7"', '#d4567c')}
    ${vol('ellipse cx="14" cy="-6" rx="12" ry="7"', '#d4567c')}
    <g class="tail">
      <path d="M-26 -150 Q-52 -120 -44 -86 Q-40 -70 -48 -58" stroke="#f0b444" stroke-width="15" fill="none" stroke-linecap="round"/>
      <path d="M-30 -146 Q-50 -120 -44 -92" stroke="#ffd77a" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${vol('circle cx="-48" cy="-60" r="9"', '#5cc0e0')}
    </g>
    ${vol('path d="M-42 -28 Q-34 -96 -16 -114 Q0 -122 16 -114 Q34 -96 42 -28 Q0 -18 -42 -28Z"', '#f590b2')}
    <path d="M-42 -28 Q0 -18 42 -28 L40 -38 Q0 -28 -40 -38Z" fill="#fff"/>
    <g fill="#fff"><circle cx="-10" cy="-70" r="4"/><circle cx="14" cy="-56" r="4"/><circle cx="2" cy="-88" r="4"/></g>
    ${arm(14, -98, 80, -112, '#f590b2', 17)}
    ${vol('circle cx="0" cy="-144" r="38"', C.skin)}
    ${vol('path d="M-38 -144 Q-40 -188 0 -190 Q38 -190 38 -150 Q28 -168 10 -166 Q14 -158 8 -152 Q-6 -166 -24 -160 Q-32 -156 -38 -144Z"', '#f2b84b')}
    ${eyes([12, -144, 5.6], [29, -144, 5.6])}
    <path d="M9 -155 l-3 -4 M26 -155 l3 -4" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    ${cheek(6, -128, 8)}${cheek(36, -130, 6)}${smile(22, -124, 10)}`,

  /* ---------------- Жучка ---------------- */
  zhuchka: `
    <g class="tail">${vol('path d="M-40 -60 Q-66 -72 -62 -100 Q-58 -112 -48 -104 Q-50 -82 -32 -70Z"', '#c98b52')}</g>
    ${vol('rect x="-34" y="-34" width="16" height="32" rx="8"', '#b37845')}
    ${vol('rect x="22" y="-34" width="16" height="32" rx="8"', '#b37845')}
    ${vol('ellipse cx="2" cy="-48" rx="48" ry="30"', '#dd9d60')}
    <ellipse cx="6" cy="-36" rx="30" ry="14" fill="#f6dcb6"/>
    <ellipse cx="-16" cy="-64" rx="16" ry="11" fill="#b37845"/>
    ${vol('rect x="-20" y="-30" width="16" height="30" rx="8"', '#dd9d60')}
    ${vol('rect x="34" y="-30" width="16" height="30" rx="8"', '#dd9d60')}
    ${vol('circle cx="48" cy="-84" r="30"', '#dd9d60')}
    ${vol('path d="M30 -108 Q16 -104 18 -76 Q22 -64 32 -70 Q34 -92 40 -104Z"', '#a8693a')}
    ${vol('ellipse cx="68" cy="-74" rx="18" ry="14"', '#f6dcb6')}
    ${vol('ellipse cx="82" cy="-80" rx="7" ry="5.5"', C.ink)}
    <path d="M70 -64 Q74 -52 80 -62Z" fill="#ff8a96"/>
    ${eyes([54, -92, 5])}
    ${cheek(46, -72, 6)}`,

  /* ---------------- кошка ---------------- */
  koshka: `
    <g class="tail">${vol('path d="M-30 -36 Q-62 -40 -60 -78 Q-58 -96 -46 -92 Q-40 -86 -46 -76 Q-50 -54 -26 -50Z"', '#8f9bb3')}</g>
    ${vol('rect x="-24" y="-24" width="13" height="24" rx="6.5"', '#8f9bb3')}
    ${vol('rect x="16" y="-24" width="13" height="24" rx="6.5"', '#8f9bb3')}
    ${vol('ellipse cx="0" cy="-34" rx="36" ry="22"', '#a9b4ca')}
    <ellipse cx="6" cy="-24" rx="20" ry="9" fill="#e9edf4"/>
    <path d="M-16 -54 q4 10 0 16 M-2 -56 q4 10 0 16" stroke="#8f9bb3" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${vol('path d="M18 -76 Q16 -102 24 -106 Q34 -96 40 -84Z"', '#a9b4ca')}
    ${vol('path d="M42 -86 Q50 -104 58 -102 Q62 -90 60 -76Z"', '#a9b4ca')}
    <path d="M23 -86 Q22 -98 26 -100 Q31 -94 33 -86Z M47 -88 Q52 -98 56 -96 Q57 -88 56 -82Z" fill="#ffb8c4"/>
    ${vol('circle cx="38" cy="-64" r="25"', '#a9b4ca')}
    <ellipse cx="50" cy="-54" rx="13" ry="9" fill="#eef1f6"/>
    ${eyes([34, -68, 4.8], [52, -68, 4.8])}
    <path d="M57 -58 l3 3 l3 -3Z" fill="#ff8a96"/>
    <path d="M64 -56 H80 M64 -52 L78 -47" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    ${cheek(30, -54, 6)}`,

  /* ---------------- мышка ---------------- */
  myshka: `
    <g class="tail"><path d="M-20 -10 Q-44 -6 -46 -24 Q-46 -34 -36 -32" stroke="#ffa9b4" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>
    ${vol('path d="M-22 -14 Q-22 -34 0 -36 Q22 -36 30 -20 Q32 -4 10 -2 H-12 Q-22 -4 -22 -14Z"', '#cbc1b7')}
    ${vol('circle cx="12" cy="-40" r="12"', '#cbc1b7')}
    <circle cx="12" cy="-40" r="7" fill="#ffb8c4"/>
    ${vol('circle cx="24" cy="-26" r="12"', '#cbc1b7')}
    ${vol('circle cx="36" cy="-24" r="3.5"', '#ff8a96')}
    ${eyes([26, -30, 3.4])}
    ${cheek(20, -20, 4)}`,
  /* ---------------- герои анфас (финал: смотрят на читателя) ---------------- */
  'ded-front': `
    ${vol('rect x="-26" y="-74" width="20" height="66" rx="10"', '#5079b3')}
    ${vol('rect x="6" y="-74" width="20" height="66" rx="10"', '#5079b3')}
    ${vol('ellipse cx="-18" cy="-6" rx="15" ry="9"', '#6a4a3a')}
    ${vol('ellipse cx="18" cy="-6" rx="15" ry="9"', '#6a4a3a')}
    ${armDown('l', -38, -136, 62, '#ee6b52')}
    ${armDown('r', 38, -136, 62, '#ee6b52')}
    ${vol('path d="M-46 -66 Q-50 -140 -12 -150 H12 Q50 -140 46 -66 Q0 -54 -46 -66Z"', '#ee6b52')}
    <path d="M0 -150 V-104" stroke="#ffc94d" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"/>
    ${vol('rect x="-47" y="-86" width="94" height="12" rx="6"', '#ffc94d')}
    ${vol('circle cx="0" cy="-194" r="46"', C.skin)}
    ${vol('path d="M-46 -196 Q-50 -236 -26 -238 Q-36 -220 -38 -196Z"', '#e2e6ee')}
    ${vol('path d="M46 -196 Q50 -236 26 -238 Q36 -220 38 -196Z"', '#e2e6ee')}
    ${vol('path d="M-42 -220 Q-40 -256 0 -258 Q40 -256 42 -220 Q0 -232 -42 -220Z"', '#5c80b0')}
    ${vol('ellipse cx="0" cy="-222" rx="44" ry="7"', '#4a6c99')}
    ${vol('path d="M-34 -182 Q-38 -130 0 -116 Q38 -130 34 -182 Q20 -166 0 -168 Q-20 -166 -34 -182Z"', C.white)}
    ${vol('path d="M-2 -176 Q-18 -186 -32 -172 Q-16 -164 -2 -170Z"', C.white)}
    ${vol('path d="M2 -176 Q18 -186 32 -172 Q16 -164 2 -170Z"', C.white)}
    <path d="M-24 -214 q8 -6 16 0 M8 -214 q8 -6 16 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${eyes([-15, -200, 5], [15, -200, 5])}
    ${vol('circle cx="0" cy="-184" r="9"', C.nose)}
    ${cheek(-30, -184, 9)}${cheek(30, -184, 9)}`,

  'babka-front': `
    ${vol('ellipse cx="-16" cy="-6" rx="14" ry="8"', '#6a4a3a')}
    ${vol('ellipse cx="16" cy="-6" rx="14" ry="8"', '#6a4a3a')}
    ${armDown('l', -26, -126, 66, '#fbe3c4', 19)}
    ${armDown('r', 26, -126, 66, '#fbe3c4', 19)}
    ${vol('path d="M-54 -8 Q-42 -110 -24 -138 Q0 -150 24 -138 Q42 -110 54 -8 Q0 4 -54 -8Z"', '#5cb080')}
    <path d="M-16 -128 Q0 -134 16 -128 Q26 -70 30 -6 Q0 0 -30 -6 Q-26 -70 -16 -128Z" fill="#fff4dc"/>
    <g fill="#ffb3a7"><circle cx="0" cy="-100" r="4"/><circle cx="-8" cy="-62" r="4"/><circle cx="8" cy="-62" r="4"/><circle cx="0" cy="-26" r="4"/></g>
    <path d="M-54 -8 Q0 4 54 -8 L52 -20 Q0 -8 -52 -20Z" fill="#ffc94d"/>
    ${vol('circle cx="0" cy="-174" r="42"', C.skin)}
    ${vol('path d="M-50 -164 Q-58 -234 0 -236 Q58 -234 50 -164 Q46 -142 32 -134 Q40 -168 34 -186 Q20 -206 0 -206 Q-20 -206 -34 -186 Q-40 -168 -32 -134 Q-46 -142 -50 -164Z"', '#f05c5c')}
    ${vol('path d="M-12 -134 L0 -124 L12 -134 L0 -140Z"', '#d94a4a')}
    <g fill="#fff" opacity=".92">
      <circle cx="-30" cy="-212" r="4"/><circle cx="-10" cy="-224" r="4"/><circle cx="10" cy="-224" r="4"/>
      <circle cx="30" cy="-212" r="4"/><circle cx="-44" cy="-180" r="3.5"/><circle cx="44" cy="-180" r="3.5"/>
    </g>
    <path d="M-26 -194 Q0 -208 26 -194 Q14 -198 0 -198 Q-14 -198 -26 -194Z" fill="#cdcdd6"/>
    ${eyes([-13, -176, 4.6], [13, -176, 4.6])}
    ${vol('circle cx="0" cy="-164" r="7"', C.nose)}
    ${cheek(-26, -158, 8)}${cheek(26, -158, 8)}${smile(0, -150, 14)}`,

  'vnuchka-front': `
    ${vol('rect x="-16" y="-32" width="10" height="26" rx="5"', C.skin)}
    ${vol('rect x="6" y="-32" width="10" height="26" rx="5"', C.skin)}
    ${vol('ellipse cx="-12" cy="-6" rx="11" ry="7"', '#d4567c')}
    ${vol('ellipse cx="12" cy="-6" rx="11" ry="7"', '#d4567c')}
    ${armDown('l', -20, -104, 52, '#f590b2', 16)}
    ${armDown('r', 20, -104, 52, '#f590b2', 16)}
    ${vol('path d="M-42 -28 Q-34 -96 -16 -114 Q0 -122 16 -114 Q34 -96 42 -28 Q0 -18 -42 -28Z"', '#f590b2')}
    <path d="M-42 -28 Q0 -18 42 -28 L40 -38 Q0 -28 -40 -38Z" fill="#fff"/>
    <g fill="#fff"><circle cx="-14" cy="-70" r="4"/><circle cx="14" cy="-60" r="4"/><circle cx="0" cy="-90" r="4"/></g>
    <path d="M30 -150 Q48 -120 38 -84" stroke="#f0b444" stroke-width="14" fill="none" stroke-linecap="round"/>
    ${vol('circle cx="38" cy="-82" r="8"', '#5cc0e0')}
    ${vol('circle cx="0" cy="-144" r="38"', C.skin)}
    ${vol('path d="M-38 -140 Q-42 -190 0 -192 Q42 -190 38 -140 Q32 -164 14 -168 Q4 -158 -6 -166 Q-24 -166 -38 -140Z"', '#f2b84b')}
    ${eyes([-13, -144, 5.6], [13, -144, 5.6])}
    <path d="M-17 -155 l-3 -4 M17 -155 l3 -4" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    ${cheek(-24, -128, 7)}${cheek(24, -128, 7)}${smile(0, -124, 11)}`,
};

/** тот же луг, но без холмика перед репкой — для финала */
SPRITES.meadow = SPRITES.field;

export const builtinSprites: SpriteRegistry = {
  has: (id) => id in SPRITES,
  markup: (id) => {
    const svg = SPRITES[id];
    if (svg === undefined) throw new Error(`Спрайт не найден: ${id}`);
    return svg;
  },
};

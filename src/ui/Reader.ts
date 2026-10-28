import type { Lang, Tale } from '../engine/types';
import type { AudioService } from '../audio/AudioService';
import type { SpriteRegistry } from '../art/sprites';
import { SceneView } from '../engine/SceneView';
import { TextPanel } from './TextPanel';
import { icon } from './icons';
import { PageTurn, type Spread } from './PageTurn';
import { glossaryFor, pageContent, pronunciationFor, resolveLang, taleLangs, taleTitle } from '../engine/i18n';
import { LANG_NAMES } from './lang';
import { Hints } from './Hints';
import { isHintLearned, markHintLearned, saveSoundOn, type HintId } from './prefs';

const HOLD_TO_EXIT_MS = 1500;
/** подсказка появляется, когда страница уже перелистнулась и успокоилась */
const HINT_DELAY_MS = 1400;
/** после первого тапа по герою — пауза, прежде чем подсказать про слова */
const HINT_NEXT_DELAY_MS = 2600;
/** сколько висит подсказка; не выучили — покажется снова на следующей странице */
const HINT_SHOW_MS = 6500;
const HINT_TEXT: Record<HintId, string> = {
  scene: 'Нажми на героя!',
  words: 'Нажми на слово!',
};

export interface ReaderOptions {
  tale: Tale;
  taleBaseUrl: string;
  audio: AudioService;
  sprites: SpriteRegistry;
  autoNarrate: boolean;
  /** желаемый язык; если у сказки его нет — основной язык сказки */
  lang: Lang;
  onLangChange?(lang: Lang): void;
  onExit(): void;
}

/** Экран чтения: слева сцена (картинка + анимации), справа текст и озвучка. */
export class Reader {
  private readonly root: HTMLElement;
  private readonly pageEl: HTMLElement;
  private readonly scene: SceneView;
  private readonly text: TextPanel;
  private readonly narrateBtn: HTMLButtonElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly dots: HTMLElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly langBtn: HTMLButtonElement;
  private readonly titleEl: HTMLElement;
  private readonly turner: PageTurn;
  private readonly hints: Hints;
  private hintTimer = 0;
  private readonly onResize = () => this.scheduleHint();
  private readonly langs: Lang[];
  private lang: Lang;
  private pageIndex = -1;
  private narrating = false;

  constructor(host: HTMLElement, private readonly o: ReaderOptions) {
    this.langs = taleLangs(o.tale);
    this.lang = resolveLang(o.tale, o.lang);
    this.root = document.createElement('div');
    this.root.className = 'reader';
    this.root.innerHTML = `
      <section class="stage" aria-label="Картинка"></section>
      <section class="page">
        <header class="bar">
          <button class="round small home" aria-label="Удерживайте, чтобы выйти">
            ${icon('home')}<svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20"/></svg>
          </button>
          <span class="hint">держите, чтобы выйти</span>
          <h1 class="title"></h1>
          <button class="round small lang" aria-label="Язык сказки"${this.langs.length > 1 ? '' : ' hidden'}></button>
          <button class="round small sound" aria-label="Звук"></button>
        </header>
        <p class="text"></p>
        <div class="controls">
          <button class="round nav prev" aria-label="Назад">${icon('prev')}</button>
          <button class="round narrate" aria-label="Читать">${icon('play')}</button>
          <button class="round nav next" aria-label="Дальше">${icon('next')}</button>
        </div>
        <div class="dots"></div>
      </section>`;
    host.appendChild(this.root);

    const $ = <T extends Element>(s: string) => this.root.querySelector<T>(s)!;
    this.scene = new SceneView($('.stage'), o.sprites, {
      onSfx: (n) => o.audio.playSfx(n),
      onTap: () => this.learned('scene'),
    });
    this.pageEl = $('.page');
    this.text = new TextPanel(
      $('.text'),
      this.pageEl,
      (word, lang) => {
        this.stopNarration();
        this.ensureSound();
        o.audio.speakWord(word, lang);
      },
      () => this.learned('words'),
    );
    this.narrateBtn = $('.narrate');
    this.prevBtn = $('.prev');
    this.nextBtn = $('.next');
    this.dots = $('.dots');
    this.soundBtn = $('.sound');
    this.langBtn = $('.lang');
    this.titleEl = $('.title');
    this.turner = new PageTurn(this.root, $('.stage'), this.pageEl);
    this.hints = new Hints(this.root);

    this.narrateBtn.addEventListener('click', () => (this.narrating ? this.stopNarration() : this.narrate()));
    this.prevBtn.addEventListener('click', () => this.go(this.pageIndex - 1));
    this.nextBtn.addEventListener('click', () => this.go(this.pageIndex + 1));
    this.soundBtn.addEventListener('click', () => {
      this.setSound(!o.audio.isSoundEnabled());
      if (!o.audio.isSoundEnabled()) this.stopNarration();
    });
    this.langBtn.addEventListener('click', () => {
      this.setLang(this.langs[(this.langs.indexOf(this.lang) + 1) % this.langs.length]);
    });
    this.setupHoldToExit($('.home'));
    this.renderSoundBtn();
    this.renderLang();
    window.addEventListener('resize', this.onResize);
    this.go(0);
  }

  destroy(): void {
    clearTimeout(this.hintTimer);
    window.removeEventListener('resize', this.onResize);
    this.hints.destroy();
    this.o.audio.stopNarration();
    this.scene.destroy();
    this.root.remove();
  }

  private go(index: number): void {
    const pages = this.o.tale.pages;
    if (index < 0 || index >= pages.length) return;
    this.stopNarration();
    this.text.hideTranslation();
    const first = this.pageIndex < 0;
    const forward = index >= this.pageIndex;
    // снимок уходящего разворота — пока на экране ещё старые картинка и текст
    const from = first ? null : this.snapshot();
    this.pageIndex = index;
    const page = pages[index];

    this.scene.render(page.scene);
    this.renderText();
    this.prevBtn.disabled = index === 0;
    this.nextBtn.disabled = index === pages.length - 1;
    this.dots.innerHTML = pages.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('');

    const turned = from !== null && this.turner.turn(from, this.snapshot(), forward);
    if (from) this.o.audio.playSfx('page');
    // текст «въезжает» сам, только если страницу не перелистнули (первая страница, reduced motion)
    this.root.classList.remove('turn-fwd', 'turn-back');
    if (!turned) {
      void this.root.offsetWidth; // перезапуск CSS-анимации текста
      this.root.classList.add(forward ? 'turn-fwd' : 'turn-back');
    }

    // при выключенном звуке сами не читаем: «Читать» по-прежнему включит звук и прочитает
    if (this.o.autoNarrate && this.o.audio.isSoundEnabled()) {
      window.setTimeout(() => this.pageIndex === index && this.o.audio.isSoundEnabled() && this.narrate(), first ? 450 : 950);
    }
    this.scheduleHint();
  }

  /** Сменить язык прямо на странице: без перелистывания, текст просто въезжает заново. */
  private setLang(lang: Lang): void {
    if (lang === this.lang) return;
    this.stopNarration();
    this.lang = lang;
    this.renderLang();
    this.renderText();
    this.root.classList.remove('turn-fwd', 'turn-back');
    void this.root.offsetWidth;
    this.root.classList.add('turn-fwd');
    this.o.onLangChange?.(lang);
    this.scheduleHint();
  }

  private renderLang(): void {
    this.titleEl.textContent = taleTitle(this.o.tale, this.lang);
    this.langBtn.textContent = LANG_NAMES[this.lang].short;
    this.langBtn.setAttribute('aria-label', `Язык: ${LANG_NAMES[this.lang].full}`);
  }

  private renderText(): void {
    const c = pageContent(this.o.tale, this.o.tale.pages[this.pageIndex], this.lang);
    this.text.setText(c.text, c.lang, glossaryFor(this.o.tale, c.lang), pronunciationFor(this.o.tale, c.lang));
  }

  private snapshot(): Spread {
    return { scene: this.scene.snapshot(), page: this.pageEl.cloneNode(true) as HTMLElement };
  }

  private narrate(): void {
    this.ensureSound();
    const page = this.o.tale.pages[this.pageIndex];
    const c = pageContent(this.o.tale, page, this.lang);
    this.narrating = true;
    this.renderNarrateBtn();
    this.o.audio.narrate(
      { taleId: this.o.tale.id, taleBaseUrl: this.o.taleBaseUrl, pageId: page.id, lang: c.lang, text: c.text, narration: c.narration },
      {
        onEnd: () => {
          this.narrating = false;
          this.renderNarrateBtn();
        },
      },
    );
  }


  private stopNarration(): void {
    this.o.audio.stopNarration();
    this.narrating = false;
    this.renderNarrateBtn();
  }

  private renderNarrateBtn(): void {
    this.narrateBtn.innerHTML = icon(this.narrating ? 'stop' : 'play');
    this.narrateBtn.classList.toggle('active', this.narrating);
    this.narrateBtn.setAttribute('aria-label', this.narrating ? 'Остановить' : 'Читать');
  }

  private setSound(on: boolean): void {
    this.o.audio.setSoundEnabled(on);
    saveSoundOn(on);
    this.renderSoundBtn();
  }

  /** «Читать» и динамик в облачке — явная просьба послушать: выключенный звук включаем обратно */
  private ensureSound(): void {
    if (!this.o.audio.isSoundEnabled()) this.setSound(true);
  }

  private renderSoundBtn(): void {
    const on = this.o.audio.isSoundEnabled();
    this.soundBtn.innerHTML = icon(on ? 'speaker' : 'speakerOff');
    this.soundBtn.classList.toggle('off', !on);
    this.soundBtn.setAttribute('aria-label', on ? 'Выключить звук' : 'Включить звук');
    this.soundBtn.setAttribute('aria-pressed', String(!on));
  }

  /* ---------- подсказки первого открытия ---------- */

  /** Какую подсказку показать на этой странице: сначала про героев, потом (в переводе) про слова. */
  private nextHint(): HintId | null {
    if (!isHintLearned('scene') && this.scene.hintPoint()) return 'scene';
    if (!isHintLearned('words') && this.text.hintPoint()) return 'words';
    return null;
  }

  private scheduleHint(delay = HINT_DELAY_MS): void {
    clearTimeout(this.hintTimer);
    this.hints.hide();
    const index = this.pageIndex;
    const lang = this.lang;
    this.hintTimer = window.setTimeout(() => {
      if (index !== this.pageIndex || lang !== this.lang) return;
      const id = this.nextHint();
      const point = id === 'scene' ? this.scene.hintPoint() : id === 'words' ? this.text.hintPoint() : null;
      if (!id || !point) return;
      // про слова — подпись над словом и в пределах страницы: текст под рукой должен оставаться виден
      const place = id === 'words' ? { above: true, bounds: this.pageEl.getBoundingClientRect() } : {};
      this.hints.show(id, point, HINT_TEXT[id], place);
      this.hintTimer = window.setTimeout(() => this.hints.hide(), HINT_SHOW_MS);
    }, delay);
  }

  /** человек сделал то, чему учила подсказка: запоминаем и, если есть, ведём к следующей */
  private learned(id: HintId): void {
    if (isHintLearned(id)) return;
    markHintLearned(id);
    if (this.hints.current === id || this.hints.current === null) this.scheduleHint(HINT_NEXT_DELAY_MS);
  }

  /** «Родительский замок»: выход только долгим нажатием — случайный тап малыша не выкинет из сказки. */
  private setupHoldToExit(btn: HTMLButtonElement): void {
    let timer = 0;
    const cancel = () => {
      clearTimeout(timer);
      btn.classList.remove('holding');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('holding');
      this.root.classList.add('show-hint');
      window.setTimeout(() => this.root.classList.remove('show-hint'), 2200);
      timer = window.setTimeout(() => {
        cancel();
        this.o.onExit();
      }, HOLD_TO_EXIT_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, cancel));
  }
}

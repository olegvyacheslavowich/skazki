import type { Tale } from '../engine/types';
import type { AudioService } from '../audio/AudioService';
import type { SpriteRegistry } from '../art/sprites';
import { SceneView } from '../engine/SceneView';
import { TextPanel } from './TextPanel';
import { icon } from './icons';
import { PageTurn } from './PageTurn';

const HOLD_TO_EXIT_MS = 1500;

export interface ReaderOptions {
  tale: Tale;
  taleBaseUrl: string;
  audio: AudioService;
  sprites: SpriteRegistry;
  autoNarrate: boolean;
  onExit(): void;
}

/** Экран чтения: слева сцена (картинка + анимации), справа текст и озвучка. */
export class Reader {
  private readonly root: HTMLElement;
  private readonly scene: SceneView;
  private readonly text: TextPanel;
  private readonly narrateBtn: HTMLButtonElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly dots: HTMLElement;
  private readonly musicBtn: HTMLButtonElement;
  private readonly turner: PageTurn;
  private pageIndex = -1;
  private narrating = false;

  constructor(host: HTMLElement, private readonly o: ReaderOptions) {
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
          <h1 class="title">${o.tale.title}</h1>
          <button class="round small music" aria-label="Музыка"></button>
        </header>
        <p class="text" lang="ru"></p>
        <div class="controls">
          <button class="round nav prev" aria-label="Назад">${icon('prev')}</button>
          <button class="round narrate" aria-label="Читать">${icon('play')}</button>
          <button class="round nav next" aria-label="Дальше">${icon('next')}</button>
        </div>
        <div class="dots"></div>
      </section>`;
    host.appendChild(this.root);

    const $ = <T extends Element>(s: string) => this.root.querySelector<T>(s)!;
    this.scene = new SceneView($('.stage'), o.sprites, { onSfx: (n) => o.audio.playSfx(n) });
    this.text = new TextPanel($('.text'));
    this.narrateBtn = $('.narrate');
    this.prevBtn = $('.prev');
    this.nextBtn = $('.next');
    this.dots = $('.dots');
    this.musicBtn = $('.music');
    this.turner = new PageTurn($('.stage'), this.root);

    this.narrateBtn.addEventListener('click', () => (this.narrating ? this.stopNarration() : this.narrate()));
    this.prevBtn.addEventListener('click', () => this.go(this.pageIndex - 1));
    this.nextBtn.addEventListener('click', () => this.go(this.pageIndex + 1));
    this.musicBtn.addEventListener('click', () => {
      o.audio.setMusicEnabled(!o.audio.isMusicEnabled());
      this.renderMusicBtn();
    });
    this.setupHoldToExit($('.home'));
    this.renderMusicBtn();
    this.go(0);
  }

  destroy(): void {
    this.o.audio.stopNarration();
    this.scene.destroy();
    this.root.remove();
  }

  private go(index: number): void {
    const pages = this.o.tale.pages;
    if (index < 0 || index >= pages.length) return;
    this.stopNarration();
    const first = this.pageIndex < 0;
    const forward = index >= this.pageIndex;
    this.pageIndex = index;
    const page = pages[index];

    this.root.classList.remove('turn-fwd', 'turn-back');
    void this.root.offsetWidth; // перезапуск CSS-анимации текста
    this.root.classList.add(forward ? 'turn-fwd' : 'turn-back');

    const from = first ? null : this.scene.snapshot();
    this.scene.render(page.scene);
    if (from) {
      this.turner.turn(from, forward ? this.scene.snapshot() : null, forward);
      this.o.audio.playSfx('page');
    }
    this.text.setText(page.text);
    this.prevBtn.disabled = index === 0;
    this.nextBtn.disabled = index === pages.length - 1;
    this.dots.innerHTML = pages.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('');

    if (this.o.autoNarrate) window.setTimeout(() => this.pageIndex === index && this.narrate(), first ? 450 : 950);
  }

  private narrate(): void {
    const page = this.o.tale.pages[this.pageIndex];
    this.narrating = true;
    this.renderNarrateBtn();
    this.text.clear();
    this.o.audio.narrate(
      { taleId: this.o.tale.id, taleBaseUrl: this.o.taleBaseUrl, page },
      {
        onWord: (i) => this.text.highlight(i),
        onEnd: () => {
          this.narrating = false;
          this.renderNarrateBtn();
          window.setTimeout(() => !this.narrating && this.text.clear(), 900);
        },
      },
    );
  }

  private stopNarration(): void {
    this.o.audio.stopNarration();
    this.narrating = false;
    this.renderNarrateBtn();
    this.text.clear();
  }

  private renderNarrateBtn(): void {
    this.narrateBtn.innerHTML = icon(this.narrating ? 'stop' : 'play');
    this.narrateBtn.classList.toggle('active', this.narrating);
    this.narrateBtn.setAttribute('aria-label', this.narrating ? 'Остановить' : 'Читать');
  }

  private renderMusicBtn(): void {
    const on = this.o.audio.isMusicEnabled();
    this.musicBtn.innerHTML = icon(on ? 'music' : 'musicOff');
    this.musicBtn.classList.toggle('off', !on);
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

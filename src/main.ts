import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import './ui/styles.css';

import { builtinSprites } from './art/sprites';
import { createAudioService } from './audio/createAudioService';
import { TaleRepository } from './engine/TaleRepository';
import { Library } from './ui/Library';
import { Reader } from './ui/Reader';
import { loadLang, saveLang } from './ui/lang';
import type { Lang } from './engine/types';

const app = document.getElementById('app')!;
const sprites = builtinSprites;
const audio = createAudioService();
const repo = new TaleRepository('./tales', sprites);

let screen: { destroy(): void } | null = null;
let lang = loadLang();
const setLang = (l: Lang) => {
  lang = l;
  saveLang(l);
};

async function showLibrary(): Promise<void> {
  screen?.destroy();
  try {
    const index = await repo.index();
    screen = new Library(app, index, sprites, lang, (id) => void openTale(id), setLang);
  } catch (e) {
    showError(e);
  }
}

async function openTale(id: string): Promise<void> {
  // Разблокируем звук синхронно с жестом пользователя — иначе iOS/Chrome не дадут играть.
  const unlocked = audio.unlock().catch((e) => console.warn('audio unlock', e));
  try {
    const tale = await repo.load(id);
    await unlocked;
    screen?.destroy();
    screen = new Reader(app, {
      tale,
      taleBaseUrl: repo.taleUrl(id),
      audio,
      sprites,
      autoNarrate: true,
      lang,
      onLangChange: setLang,
      onExit: () => void showLibrary(),
    });
  } catch (e) {
    showError(e);
  }
}

function showError(e: unknown): void {
  console.error(e);
  screen?.destroy();
  screen = null;
  const pre = document.createElement('pre');
  pre.className = 'error';
  pre.textContent = e instanceof Error ? e.message : String(e);
  app.replaceChildren(pre);
}

document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));
// без контекстного меню и выделения по долгому тапу
document.addEventListener('contextmenu', (e) => e.preventDefault());

void showLibrary();

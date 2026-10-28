/**
 * Настройки, которые живут на устройстве: звук и показанные подсказки.
 * Без хранилища (приватный режим) — значения по умолчанию, просто не запоминаем.
 */

const SOUND_KEY = 'skazki.sound';
const HINT_KEY = 'skazki.hint.';

/** подсказки первого открытия: тап по герою и (в переводе) тап по слову */
export type HintId = 'scene' | 'words';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* нет хранилища */
  }
}

export const loadSoundOn = (): boolean => get(SOUND_KEY) !== 'off';
export const saveSoundOn = (on: boolean): void => set(SOUND_KEY, on ? 'on' : 'off');

/** человек уже сделал то, чему учит подсказка, — больше не показываем */
export const isHintLearned = (id: HintId): boolean => get(HINT_KEY + id) === '1';
export const markHintLearned = (id: HintId): void => set(HINT_KEY + id, '1');

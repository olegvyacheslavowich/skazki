#!/usr/bin/env node
/**
 * Транскрипция русскими буквами для тапа по английскому слову (go → гоу).
 *
 * Берёт слова из словарика (translations.en.glossary) каждой сказки в public/tales/
 * и дописывает недостающие в translations.en.pronunciation. Уже записанные НЕ трогает:
 * ручные правки в tale.json сохраняются. Пересчитать всё заново — флаг --force.
 *
 * Источник произношений — CMU Pronouncing Dictionary (американский английский, ARPAbet),
 * дальше фонемы переводятся в кириллицу по таблице ниже. Ударение — знак ́ над гласной
 * в словах из двух и более слогов («грэ́ндпа»).
 *
 *   npm run pronounce            дописать недостающие
 *   npm run pronounce -- --force пересчитать все (ручные правки потеряются)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionary } from 'cmu-pronouncing-dictionary';

const LANG = 'en';
const STRESS = '́';

// гласные ARPAbet → кириллица
const V = {
  AA: 'а', AE: 'э', AH: 'а', AO: 'о', AW: 'ау', AY: 'ай', EH: 'е', ER: 'ёр',
  EY: 'эй', IH: 'и', IY: 'и', OW: 'оу', OY: 'ой', UH: 'у', UW: 'у',
};
// согласные
const C = {
  B: 'б', CH: 'ч', D: 'д', DH: 'з', F: 'ф', G: 'г', HH: 'х', JH: 'дж', K: 'к',
  L: 'л', M: 'м', N: 'н', NG: 'нг', P: 'п', R: 'р', S: 'с', SH: 'ш', T: 'т',
  TH: 'с', V: 'в', W: 'у', Y: 'й', Z: 'з', ZH: 'ж',
};
// Y + гласная сливаются: you → ю, yard → ярд, yes → йес
const Y_SOFT = { UW: 'ю', UH: 'ю', AA: 'я', AE: 'я', AH: 'я', EH: 'йе', AO: 'ё' };
const RU_VOWEL = /[аеёиоуыэюя]/;

/** ARPAbet («G OW1») → кириллица («гоу»). */
export function arpabetToRu(arpa, { stress = true } = {}) {
  const ph = arpa.trim().split(/\s+/).map((p) => {
    const [, sym, st] = p.match(/^([A-Z]+)(\d)?$/);
    return { sym, st };
  });
  const syllables = ph.filter((p) => p.st !== undefined).length;
  let out = '';
  for (let i = 0; i < ph.length; i++) {
    const { sym, st } = ph[i];
    const atStart = out === '' || /[аеёиоуыэюяй]$/.test(out);
    let piece;
    let stressed = st === '1';

    if (sym === 'Y' && ph[i + 1] && Y_SOFT[ph[i + 1].sym]) {
      piece = Y_SOFT[ph[i + 1].sym];
      stressed = ph[i + 1].st === '1';
      i++;
    } else if (V[sym]) {
      piece = V[sym];
      if (sym === 'AH' && st === '0') piece = 'э';     // the → зэ, hello → хэлоу
      if (sym === 'ER' && st !== '1') piece = atStart ? 'эр' : 'ер'; // water → уотер, our → ауэр
      if (sym === 'EH' && atStart) piece = 'э';        // egg → эг (после согласной — е: very → вери)
    } else if (sym === 'NG' && /^[KG]$/.test(ph[i + 1]?.sym ?? '')) {
      piece = 'н';                                     // thank → сэнк, finger → фингер
    } else {
      piece = C[sym] ?? '';
    }

    // ударение — после первой гласной буквы куска; «ё» всегда ударная, её не помечаем
    if (stress && stressed && syllables > 1) {
      const k = piece.search(RU_VOWEL);
      if (k >= 0 && piece[k] !== 'ё') piece = piece.slice(0, k + 1) + STRESS + piece.slice(k + 1);
    }
    out += piece;
  }
  return out;
}

/** Ключ словарика → слово для CMU (can't → can't, grandpa's → grandpa's). */
function cmuLookup(word) {
  return dictionary[word] ?? dictionary[word.replace(/'s$/, '')] ?? null;
}

/**
 * JSON как в tale.json: отступ 2 пробела, но маленькие «плоские» объекты в одну строку
 * ({ "src": "audio/p1.mp3" }) — чтобы скрипт не устраивал лишний diff.
 */
function stringify(value, indent = '') {
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const inner = indent + '  ';
    return `[\n${value.map((v) => inner + stringify(v, inner)).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    const flat = entries.every(([, v]) => v === null || typeof v !== 'object');
    if (flat && entries.length === 1) {
      const one = `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
      if (one.length <= 60) return one;
    }
    const inner = indent + '  ';
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringify(v, inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function main() {
  const force = process.argv.includes('--force');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tales');
  let failed = false;

  for (const id of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const file = join(root, id, 'tale.json');
    if (!existsSync(file)) continue;
    const tale = JSON.parse(readFileSync(file, 'utf8'));
    const tr = tale.translations?.[LANG];
    if (!tr?.glossary) continue;

    const old = force ? {} : (tr.pronunciation ?? {});
    const next = {};
    const added = [];
    const missing = [];
    for (const word of Object.keys(tr.glossary)) {
      if (old[word]) { next[word] = old[word]; continue; }
      const arpa = cmuLookup(word);
      if (!arpa) { missing.push(word); continue; }
      next[word] = arpabetToRu(arpa);
      added.push(`${word} → ${next[word]}`);
    }

    if (!added.length && !force && tr.pronunciation && Object.keys(old).length === Object.keys(next).length) {
      console.log(`${id}: всё на месте (${Object.keys(next).length})`);
      if (missing.length) { failed = true; console.warn(`  нет в словаре CMU: ${missing.join(', ')}`); }
      continue; // файл не трогаем
    }

    // pronunciation сразу после glossary — порядок ключей сохраняем
    const rebuilt = {};
    for (const [k, v] of Object.entries(tr)) {
      if (k === 'pronunciation') continue;
      rebuilt[k] = v;
      if (k === 'glossary') rebuilt.pronunciation = next;
    }
    tale.translations[LANG] = rebuilt;
    writeFileSync(file, stringify(tale) + '\n');

    console.log(`${id}: добавлено ${added.length}, всего ${Object.keys(next).length}`);
    for (const a of added) console.log(`  ${a}`);
    if (missing.length) {
      failed = true;
      console.warn(`  нет в словаре CMU, впишите руками в translations.${LANG}.pronunciation: ${missing.join(', ')}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

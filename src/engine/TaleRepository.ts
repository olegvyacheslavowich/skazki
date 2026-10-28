import type { Lang, Tale, TaleIndex } from './types';
import { hasAnimation } from './animations';
import { hasEffect } from './effects';
import { glossaryKey } from './i18n';
import { splitWords } from './words';
import type { SpriteRegistry } from '../art/sprites';

/**
 * Источник сказок. Сейчас — файлы, вшитые в сборку (public/tales).
 * Позже здесь же появится загрузка пакетов (Play Asset Delivery / iOS On-Demand Resources / сервер):
 * интерфейс не меняется, меняется только baseUrl.
 */
export class TaleRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly sprites: SpriteRegistry,
  ) {}

  taleUrl(id: string): string {
    return `${this.baseUrl}/${id}`;
  }

  async index(): Promise<TaleIndex> {
    return this.fetchJson<TaleIndex>(`${this.baseUrl}/index.json`);
  }

  async load(id: string): Promise<Tale> {
    const tale = await this.fetchJson<Tale>(`${this.taleUrl(id)}/tale.json`);
    this.validate(tale);
    return tale;
  }

  /** Ошибки контента ловим при загрузке, а не когда ребёнок тапнет по деду. */
  private validate(tale: Tale): void {
    const problems: string[] = [];
    for (const p of tale.pages) {
      const ids = new Set(p.scene.elements.map((e) => e.id));
      const groups = p.scene.groups ?? {};
      if (!this.sprites.has(p.scene.background)) problems.push(`${p.id}: нет фона ${p.scene.background}`);
      for (const e of p.scene.elements) {
        if (!this.sprites.has(e.sprite)) problems.push(`${p.id}/${e.id}: нет спрайта ${e.sprite}`);
        if (e.onTap && !p.scene.actions?.[e.onTap]) problems.push(`${p.id}/${e.id}: нет действия ${e.onTap}`);
      }
      for (const [name, members] of Object.entries(groups)) {
        for (const m of members) if (!ids.has(m)) problems.push(`${p.id}: группа ${name} ссылается на ${m}`);
      }
      for (const [name, calls] of Object.entries(p.scene.actions ?? {})) {
        for (const c of calls) {
          if (!ids.has(c.target) && !groups[c.target]) problems.push(`${p.id}/${name}: неизвестная цель ${c.target}`);
          if (!c.animation && !c.fx) problems.push(`${p.id}/${name}: нужен animation или fx`);
          if (c.animation && !hasAnimation(c.animation)) problems.push(`${p.id}/${name}: неизвестная анимация ${c.animation}`);
          if (c.fx && !hasEffect(c.fx)) problems.push(`${p.id}/${name}: неизвестный эффект ${c.fx}`);
        }
      }
    }
    problems.push(...this.validateTranslations(tale));
    if (problems.length) throw new Error(`Сказка «${tale.id}» содержит ошибки:\n${problems.join('\n')}`);
  }

  /** У каждой страницы есть текст перевода, и каждое его слово есть в словарике (тап по слову). */
  private validateTranslations(tale: Tale): string[] {
    const problems: string[] = [];
    const base = tale.lang ?? 'ru';
    const langs = Object.keys(tale.translations ?? {}) as Lang[];
    for (const lang of langs) {
      const tr = tale.translations![lang]!;
      if (lang === base) problems.push(`перевод на ${lang} совпадает с основным языком сказки`);
      if (!tr.title) problems.push(`${lang}: нет названия`);
      const glossary = tr.glossary ?? {};
      if (tr.pronunciation) {
        const noPron = Object.keys(glossary).filter((k) => !tr.pronunciation![k]);
        if (noPron.length) problems.push(`${lang}: нет произношения (npm run pronounce): ${noPron.join(', ')}`);
      }
      for (const p of tale.pages) {
        const text = p.translations?.[lang]?.text;
        if (!text) {
          problems.push(`${p.id}: нет текста на ${lang}`);
          continue;
        }
        const missing = new Set(
          splitWords(text)
            .map((w) => glossaryKey(w.text))
            .filter((k) => k && !(k in glossary)),
        );
        if (missing.size) problems.push(`${p.id}: нет в словарике ${lang}: ${[...missing].join(', ')}`);
      }
    }
    for (const p of tale.pages) {
      for (const lang of Object.keys(p.translations ?? {})) {
        if (!langs.includes(lang as Lang)) problems.push(`${p.id}: перевод на ${lang}, которого нет в tale.translations`);
      }
    }
    return problems;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Не удалось загрузить ${url}: ${r.status}`);
    return (await r.json()) as T;
  }
}

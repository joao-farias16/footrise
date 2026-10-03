import { describe, expect, it } from 'vitest';
import { DRAFT } from '../config/balance';
import { memoryStore, loadCurrent, saveCurrent } from '../state/storage';
import { createCareer, draftPick, draftReroll } from './career';
import { applyDraftPick, createDraft, isDraftComplete, legendValue, rerollDraftRound } from './draft';
import { LEGEND_BY_ID } from '../data/legends';
import { Rng } from './rng';
import { profile } from './testUtils';

describe('reroll do draft', () => {
  it('nova carreira começa com o reroll disponível', () => {
    expect(createDraft('ATA', new Rng(1)).rerollUsed).toBe(false);
    expect(createCareer(profile('MEI'), 'analyst', 5).draft.rerollUsed).toBe(false);
  });

  it('troca as opções da rodada atual sem avançar nem mexer nas escolhas', () => {
    let c = createCareer(profile('PD'), 'analyst', 77);
    c = draftPick(c, 0);
    c = draftPick(c, 1);
    const before = c;
    const after = draftReroll(c);

    expect(after.draft.rerollUsed).toBe(true);
    expect(after.draft.round).toBe(before.draft.round);
    expect(after.draft.slots).toEqual(before.draft.slots);
    expect(after.draft.picks).toEqual(before.draft.picks);
    expect(after.draft.usedLegends).toEqual(before.draft.usedLegends);
    expect(after.profile).toEqual(before.profile);
    expect(after.phase).toBe('draft');
    // Lendas novas, diferentes das que estavam na rodada.
    const old = new Set(before.draft.current!.legendIds);
    expect(after.draft.current!.legendIds.some((id) => old.has(id))).toBe(false);
    expect(after.draft.current!.legendIds).toHaveLength(DRAFT.legendsPerRound);
    for (const o of after.draft.current!.options) {
      expect(o.value).toBe(legendValue(LEGEND_BY_ID[o.legendId], o.attr));
      expect(before.draft.usedLegends).not.toContain(o.legendId);
    }
  });

  it('só pode ser usado uma vez por carreira', () => {
    const once = draftReroll(createCareer(profile('ATA'), 'analyst', 3));
    expect(draftReroll(once)).toBe(once);
    const rng = new Rng(9);
    const d = rerollDraftRound(createDraft('ATA', rng), 'ATA', rng);
    expect(rerollDraftRound(d, 'ATA', rng)).toBe(d);
  });

  it('o draft continua normal depois do reroll e o estado se mantém nas rodadas', () => {
    let c = draftReroll(createCareer(profile('GOL'), 'instinct', 21));
    const opt = c.draft.current!.options[2];
    c = draftPick(c, 2);
    expect(c.draft.round).toBe(2);
    expect(c.draft.slots[opt.attr]).toEqual({ value: opt.value, source: opt.legendId });
    expect(c.draft.rerollUsed).toBe(true);
    while (c.phase === 'draft') c = draftPick(c, 0);
    expect(c.phase).toBe('card');
    expect(c.draft.picks).toHaveLength(DRAFT.rounds);
    expect(new Set(c.draft.usedLegends).size).toBe(c.draft.usedLegends.length);
  });

  it('draft sem reroll é idêntico ao de antes', () => {
    const rng = new Rng(42);
    let d = createDraft('MEI', rng);
    while (!isDraftComplete(d)) d = applyDraftPick(d, 'MEI', 1, rng);
    expect(d.rerollUsed).toBe(false);
    expect(d.picks).toHaveLength(DRAFT.rounds);
  });

  it('uma nova carreira restaura o reroll', () => {
    const used = draftReroll(createCareer(profile('ATA'), 'analyst', 10));
    expect(used.draft.rerollUsed).toBe(true);
    expect(createCareer(profile('ATA'), 'analyst', 11).draft.rerollUsed).toBe(false);
  });

  it('o reroll usado é persistido; saves antigos ficam com reroll disponível', () => {
    const store = memoryStore();
    const used = draftReroll(createCareer(profile('ZAG'), 'analyst', 8));
    saveCurrent(store, used);
    expect(loadCurrent(store)!.draft.rerollUsed).toBe(true);

    const legacy = createCareer(profile('ZAG'), 'analyst', 8);
    delete legacy.draft.rerollUsed;
    saveCurrent(store, legacy);
    const loaded = loadCurrent(store)!;
    expect(loaded.draft.rerollUsed).toBeUndefined();
    expect(draftReroll(loaded).draft.rerollUsed).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { attrKeysFor, POSITIONS } from '../config/positions';
import { loadCurrent, memoryStore, saveCurrent } from '../state/storage';
import type { Career, PositionId } from '../types';
import { createCareer, draftPick, draftReroll } from './career';
import { applyDraftPick, emptyAttrs } from './draft';
import { Rng } from './rng';
import { profile } from './testUtils';

const POSITION_IDS = Object.keys(POSITIONS) as PositionId[];

function filledCount(c: Career): number {
  return attrKeysFor(c.profile.position).filter((k) => c.draft.slots[k]).length;
}

function expectOnlyEmptyOptions(c: Career) {
  for (const o of c.draft.current!.options) expect(c.draft.slots[o.attr]).toBeUndefined();
}

describe('draft: 6 atributos = 6 escolhas, atributo escolhido bloqueado', () => {
  it('nova carreira começa com 6 atributos vazios e reroll disponível', () => {
    for (const pos of POSITION_IDS) {
      const c = createCareer(profile(pos), 'analyst', 1);
      expect(emptyAttrs(c.draft, pos)).toHaveLength(6);
      expect(c.draft.totalRounds).toBe(6);
      expect(c.draft.rerollUsed).toBe(false);
    }
  });

  it('cada escolha preenche 1 atributo novo, nunca repete e termina na 6ª escolha', () => {
    for (const pos of POSITION_IDS) {
      for (let seed = 1; seed <= 25; seed++) {
        let c = createCareer(profile(pos), 'analyst', seed);
        const rerollAt = seed % 7; // 0..6 (6 = nunca)
        let picks = 0;
        while (c.phase === 'draft') {
          if (picks === rerollAt) {
            const before = c;
            c = draftReroll(c);
            // Reroll não conta como escolha nem mexe nos atributos.
            expect(c.draft.round).toBe(before.draft.round);
            expect(c.draft.slots).toEqual(before.draft.slots);
            expect(c.draft.picks).toEqual(before.draft.picks);
            expect(c.draft.rerollUsed).toBe(true);
          }
          expectOnlyEmptyOptions(c);
          const opt = c.draft.current!.options[seed % c.draft.current!.options.length];
          const filledBefore = filledCount(c);
          c = draftPick(c, seed % c.draft.current!.options.length);
          picks++;
          expect(filledCount(c)).toBe(filledBefore + 1);
          expect(c.draft.slots[opt.attr]).toEqual({ value: opt.value, source: opt.legendId });
        }
        expect(picks).toBe(6);
        expect(c.phase).toBe('card');
        expect(c.draft.current).toBeNull();
        expect(c.draft.picks).toHaveLength(6);
        expect(new Set(c.draft.picks.map((p) => p.attr)).size).toBe(6);
        expect(c.draft.picks.every((p) => p.replaced === undefined)).toBe(true);
        for (const k of attrKeysFor(pos)) expect(c.sources[k]).not.toBe('academy');
        // Não existe 7ª escolha.
        expect(draftPick(c, 0)).toBe(c);
      }
    }
  });

  it('a lógica rejeita escolher um atributo já bloqueado', () => {
    let c = createCareer(profile('ATA'), 'analyst', 4);
    const first = c.draft.current!.options[0];
    c = draftPick(c, 0);
    const forged = structuredClone(c.draft);
    forged.current!.options[0] = { ...forged.current!.options[0], attr: first.attr, value: 99 };
    const after = applyDraftPick(forged, 'ATA', 0, new Rng(1));
    expect(after).toBe(forged);
    expect(after.slots[first.attr]!.value).toBe(first.value);
  });

  it('reroll só pode ser usado uma vez e só gera atributos vazios', () => {
    let c = createCareer(profile('GOL'), 'analyst', 12);
    for (let i = 0; i < 5; i++) c = draftPick(c, 0);
    const used = draftReroll(c);
    expect(emptyAttrs(used.draft, 'GOL')).toHaveLength(1);
    expectOnlyEmptyOptions(used);
    expect(draftReroll(used)).toBe(used);
  });

  it('recarregar não libera atributos bloqueados e nova carreira limpa tudo', () => {
    const store = memoryStore();
    let c = draftReroll(createCareer(profile('MEI'), 'analyst', 30));
    c = draftPick(draftPick(c, 0), 1);
    saveCurrent(store, c);
    const loaded = loadCurrent(store)!;
    expect(loaded.draft.slots).toEqual(c.draft.slots);
    expect(loaded.draft.round).toBe(3);
    expect(loaded.draft.rerollUsed).toBe(true);
    expectOnlyEmptyOptions(loaded);

    const fresh = createCareer(profile('MEI'), 'analyst', 31);
    expect(fresh.draft.slots).toEqual({});
    expect(fresh.draft.rerollUsed).toBe(false);
  });

  it('save antigo (8 rodadas, opção de atributo já preenchido) é corrigido ao carregar', () => {
    const store = memoryStore();
    let c = createCareer(profile('ATA'), 'analyst', 50);
    c = draftPick(draftPick(c, 0), 0);
    const legacy = structuredClone(c);
    const taken = Object.keys(legacy.draft.slots)[0] as keyof typeof legacy.draft.slots;
    legacy.draft.totalRounds = 8;
    legacy.draft.round = 4;
    legacy.draft.current!.options[0] = { ...legacy.draft.current!.options[0], attr: taken };
    saveCurrent(store, legacy);
    const loaded = loadCurrent(store)!;
    expect(loaded.draft.totalRounds).toBe(6);
    expect(loaded.draft.round).toBe(3);
    expect(loaded.draft.slots).toEqual(legacy.draft.slots);
    expectOnlyEmptyOptions(loaded);

    // Save antigo com os 6 já preenchidos encerra o draft.
    const full = structuredClone(legacy);
    for (const k of attrKeysFor('ATA')) full.draft.slots[k] ??= { value: 80, source: 'pele' };
    saveCurrent(store, full);
    expect(loadCurrent(store)!.phase).toBe('card');
  });
});

import { describe, expect, it } from 'vitest';
import { DRAFT } from '../config/balance';
import { KEEPER_KEYS, OUTFIELD_KEYS } from '../config/positions';
import { LEGEND_BY_ID } from '../data/legends';
import type { DraftState, PositionId } from '../types';
import { applyDraftPick, createDraft, finalizeDraft, isDraftComplete, legendValue, optionGain } from './draft';
import { Rng } from './rng';

function runDraft(position: PositionId, seed: number): DraftState {
  const rng = new Rng(seed);
  let d = createDraft(position, rng);
  while (!isDraftComplete(d)) d = applyDraftPick(d, position, 0, rng);
  return d;
}

describe('draft', () => {
  it('é reproduzível com a mesma seed', () => {
    const a = createDraft('ATA', new Rng(42));
    const b = createDraft('ATA', new Rng(42));
    expect(a.current).toEqual(b.current);
  });

  it('gera rodadas com lendas distintas e opções válidas', () => {
    const d = createDraft('MEI', new Rng(7));
    const round = d.current!;
    expect(round.legendIds).toHaveLength(DRAFT.legendsPerRound);
    expect(new Set(round.legendIds).size).toBe(round.legendIds.length);
    for (const o of round.options) {
      expect(OUTFIELD_KEYS).toContain(o.attr);
      expect(o.value).toBe(legendValue(LEGEND_BY_ID[o.legendId], o.attr));
    }
  });

  it('escolher um atributo preenche o slot com o valor e a origem', () => {
    const rng = new Rng(3);
    const d = createDraft('PD', rng);
    const opt = d.current!.options[1];
    const next = applyDraftPick(d, 'PD', 1, rng);
    expect(next.slots[opt.attr]).toEqual({ value: opt.value, source: opt.legendId });
    expect(next.round).toBe(2);
    expect(next.picks[0]).toMatchObject({ legendId: opt.legendId, attr: opt.attr });
  });

  it('termina após o número de rodadas, sem repetir lendas', () => {
    const d = runDraft('ATA', 99);
    expect(d.picks).toHaveLength(DRAFT.rounds);
    expect(d.current).toBeNull();
    expect(new Set(d.usedLegends).size).toBe(d.usedLegends.length);
  });

  it('atributos não escolhidos vêm da academia dentro da faixa', () => {
    const d: DraftState = {
      round: 9,
      totalRounds: 8,
      current: null,
      slots: { sho: { value: 95, source: 'messi' } },
      picks: [],
      usedLegends: [],
    };
    const { potential, sources } = finalizeDraft(d, 'ATA', new Rng(5));
    expect(potential.sho).toBe(95);
    for (const k of OUTFIELD_KEYS.filter((k) => k !== 'sho')) {
      expect(sources[k]).toBe('academy');
      expect(potential[k]).toBeGreaterThanOrEqual(DRAFT.academyMin);
      expect(potential[k]).toBeLessThanOrEqual(DRAFT.academyMax);
    }
  });

  it('valoriza preencher lacunas mais do que melhorar um atributo já alto', () => {
    const slots = { pac: { value: 98, source: 'mbappe' }, dri: { value: 96, source: 'messi' } };
    const morePace = optionGain(slots, 'PD', { attr: 'pac', value: 99 });
    const passing = optionGain(slots, 'PD', { attr: 'pas', value: 91 });
    expect(passing).toBeGreaterThan(morePace * 5);
  });

  it('a posição define o que vale mais', () => {
    const shooting = { attr: 'sho' as const, value: 95 };
    expect(optionGain({}, 'ATA', shooting)).toBeGreaterThan(optionGain({}, 'ZAG', shooting));
  });

  it('goleiro recebe atributos de goleiro', () => {
    const d = runDraft('GOL', 11);
    for (const p of d.picks) expect(KEEPER_KEYS).toContain(p.attr);
  });

  it('quase sempre existe uma escolha que vale a pena na rodada', () => {
    let rounds = 0;
    let good = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new Rng(seed);
      let d = createDraft('MEI', rng);
      while (!isDraftComplete(d)) {
        const best = Math.max(...d.current!.options.map((o) => optionGain(d.slots, 'MEI', o)));
        rounds++;
        if (best >= 1) good++;
        d = applyDraftPick(d, 'MEI', seed % 3, rng);
      }
    }
    expect(good / rounds).toBeGreaterThan(0.85);
  });

  it('cada carreira gera um draft diferente', () => {
    expect(runDraft('ATA', 1).usedLegends.join()).not.toBe(runDraft('ATA', 2).usedLegends.join());
  });
});

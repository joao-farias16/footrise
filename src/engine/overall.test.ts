import { describe, expect, it } from 'vitest';
import { POSITIONS, attrKeysFor } from '../config/positions';
import type { PositionId } from '../types';
import { computeOverall, weightTier } from './overall';

describe('overall', () => {
  it('pesos de cada posição somam 1 e usam só as chaves da posição', () => {
    for (const pos of Object.keys(POSITIONS) as PositionId[]) {
      const w = POSITIONS[pos].weights;
      const sum = Object.values(w).reduce((s, v) => s + (v ?? 0), 0);
      expect(sum).toBeCloseTo(1, 5);
      for (const k of Object.keys(w)) expect(attrKeysFor(pos)).toContain(k);
    }
  });

  it('atributos iguais dão overall igual ao valor', () => {
    const attrs = { pac: 80, sho: 80, pas: 80, dri: 80, def: 80, phy: 80 };
    expect(computeOverall(attrs, 'ATA')).toBe(80);
    expect(computeOverall(attrs, 'ZAG')).toBe(80);
  });

  it('a posição muda o valor do mesmo jogador', () => {
    const striker = { pac: 92, sho: 95, pas: 75, dri: 90, def: 35, phy: 80 };
    expect(computeOverall(striker, 'ATA')).toBeGreaterThan(computeOverall(striker, 'ZAG') + 15);
    const defender = { pac: 75, sho: 45, pas: 72, dri: 65, def: 94, phy: 90 };
    expect(computeOverall(defender, 'ZAG')).toBeGreaterThan(computeOverall(defender, 'ATA') + 15);
  });

  it('goleiro usa atributos próprios', () => {
    const gk = { div: 90, han: 88, ref: 92, gkp: 90, kic: 70, phy: 80 };
    expect(computeOverall(gk, 'GOL')).toBeGreaterThanOrEqual(87);
    expect(computeOverall({ pac: 99, sho: 99 }, 'GOL')).toBe(0);
  });

  it('classifica a importância dos atributos', () => {
    expect(weightTier('ATA', 'sho')).toBe('alta');
    expect(weightTier('ATA', 'def')).toBe('baixa');
    expect(weightTier('ZAG', 'def')).toBe('alta');
  });
});

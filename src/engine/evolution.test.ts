import { describe, expect, it } from 'vitest';
import { EVOLUTION } from '../config/balance';
import type { Attributes } from '../types';
import { evolveAttributes, initialAttributes } from './evolution';
import { computeOverall } from './overall';
import { Rng } from './rng';

const potential: Attributes = { pac: 92, sho: 94, pas: 82, dri: 90, def: 45, phy: 84 };

function season(attrs: Attributes, age: number, minutes: number, rating: number, seed: number) {
  return evolveAttributes({ attributes: attrs, potential, position: 'ATA', age, minutes, rating, leagueStrength: 84 }, new Rng(seed));
}

describe('evolução', () => {
  it('começa abaixo do potencial, mais cru quanto mais jovem', () => {
    const young = computeOverall(initialAttributes(potential, 'ATA', 16, new Rng(1)), 'ATA');
    const older = computeOverall(initialAttributes(potential, 'ATA', 20, new Rng(1)), 'ATA');
    expect(young).toBeLessThan(older);
    expect(older).toBeLessThan(computeOverall(potential, 'ATA'));
  });

  it('jovem com minutos evolui mais do que jovem no banco', () => {
    const start = initialAttributes(potential, 'ATA', 18, new Rng(2));
    let played = 0;
    let bench = 0;
    for (let s = 0; s < 30; s++) {
      played += computeOverall(season(start, 18, 3000, 7.1, s).attributes, 'ATA');
      bench += computeOverall(season(start, 18, 300, 6.4, s).attributes, 'ATA');
    }
    expect(played / 30).toBeGreaterThan(bench / 30 + 1);
  });

  it('não cresce além do potencial + margem', () => {
    let attrs = initialAttributes(potential, 'ATA', 17, new Rng(3));
    for (let age = 17; age < 30; age++) attrs = season(attrs, age, 3200, 8.2, age).attributes;
    for (const [k, v] of Object.entries(attrs)) {
      expect(v).toBeLessThanOrEqual((potential[k as keyof Attributes] ?? 0) + EVOLUTION.overPotentialCap);
    }
  });

  it('atinge um pico e depois declina com a idade', () => {
    let attrs = initialAttributes(potential, 'ATA', 17, new Rng(4));
    const ovrByAge: Record<number, number> = {};
    for (let age = 17; age <= 38; age++) {
      attrs = season(attrs, age, 2600, 7.0, age * 13).attributes;
      ovrByAge[age] = computeOverall(attrs, 'ATA');
    }
    expect(ovrByAge[27]).toBeGreaterThan(ovrByAge[18]);
    expect(ovrByAge[38]).toBeLessThan(ovrByAge[28] - 10);
  });

  it('goleiros declinam mais tarde', () => {
    const gk: Attributes = { div: 88, han: 88, ref: 88, gkp: 88, kic: 75, phy: 80 };
    const r = evolveAttributes({ attributes: gk, potential: gk, position: 'GOL', age: 31, minutes: 3000, rating: 7, leagueStrength: 84 }, new Rng(1));
    expect(Object.values(r.delta).every((d) => (d ?? 0) >= 0)).toBe(true);
  });
});

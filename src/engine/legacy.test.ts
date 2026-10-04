import { describe, expect, it } from 'vitest';
import { LEGACY_TIERS } from '../config/balance';
import type { Trophy } from '../types';
import { computeLegacy, LEGACY_WEIGHTS, legacyTier, type LegacyInput } from './legacy';

const modest: LegacyInput = {
  peakOvr: 76,
  position: 'ATA',
  apps: 320,
  goals: 70,
  assists: 25,
  cleanSheets: 0,
  trophies: [],
  awards: [],
  nationalCaps: 0,
  nationalGoals: 0,
  playedWorldCup: false,
  avgClubStrength: 68,
  goodSeasons: 1,
  totalSeasons: 12,
};

function trophies(kind: Trophy['kind'], name: string, n: number): Trophy[] {
  return Array.from({ length: n }, (_, i) => ({ kind, name, season: `20${30 + i}/${31 + i}`, team: 'X' }));
}

const legend: LegacyInput = {
  peakOvr: 95,
  position: 'ATA',
  apps: 820,
  goals: 610,
  assists: 240,
  cleanSheets: 0,
  trophies: [
    ...trophies('league', 'Liga Espanhola', 9),
    ...trophies('continental', 'Copa dos Campeões da Europa', 4),
    ...trophies('worldCup', 'Copa do Mundo', 1),
    ...trophies('cup', 'Copa do Rei', 5),
  ],
  awards: Array.from({ length: 6 }, (_, i) => ({ kind: 'world' as const, name: 'Bola de Ouro', season: `${i}` })),
  nationalCaps: 160,
  nationalGoals: 90,
  playedWorldCup: true,
  avgClubStrength: 89,
  goodSeasons: 15,
  totalSeasons: 18,
};

describe('legado', () => {
  it('pesos somam 100', () => {
    expect(Object.values(LEGACY_WEIGHTS).reduce((s, v) => s + v, 0)).toBe(100);
  });

  it('fica entre 0 e 100 e separa carreiras modestas de lendárias', () => {
    const a = computeLegacy(modest);
    const b = computeLegacy(legend);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(b.score).toBeLessThanOrEqual(100);
    expect(a.score).toBeLessThan(40);
    expect(b.score).toBeGreaterThanOrEqual(90);
    expect(['LENDÁRIO', 'ÍCONE']).toContain(b.tier);
  });

  it('não depende de uma única variável', () => {
    const base = computeLegacy({ ...modest, peakOvr: 88 }).score;
    expect(computeLegacy({ ...modest, peakOvr: 88, trophies: trophies('league', 'Liga Inglesa', 5) }).score).toBeGreaterThan(base);
    expect(computeLegacy({ ...modest, peakOvr: 88, nationalCaps: 80, nationalGoals: 30 }).score).toBeGreaterThan(base);
    expect(computeLegacy({ ...modest, peakOvr: 88, apps: 700 }).score).toBeGreaterThan(base);
    expect(computeLegacy({ ...modest, peakOvr: 92 }).score).toBeGreaterThan(base);
  });

  it('títulos continentais valem mais do que copas nacionais', () => {
    const cups = computeLegacy({ ...modest, trophies: trophies('cup', 'Copa do Rei', 3) }).score;
    const continental = computeLegacy({ ...modest, trophies: trophies('continental', 'Copa dos Campeões da Europa', 3) }).score;
    expect(continental).toBeGreaterThan(cups);
  });

  it('o detalhamento soma a pontuação', () => {
    const r = computeLegacy(legend);
    const sum = r.breakdown.reduce((s, b) => s + b.points, 0);
    expect(Math.abs(Math.round(sum) - r.score)).toBeLessThanOrEqual(1);
    for (const b of r.breakdown) expect(b.points).toBeLessThanOrEqual(b.max);
  });

  it('faixas de classificação cobrem 0–100', () => {
    expect(legacyTier(0).name).toBe('PROMESSA');
    expect(legacyTier(100).name).toBe('ÍCONE');
    for (let s = 0; s <= 100; s++) expect(LEGACY_TIERS.map((t) => t.name)).toContain(legacyTier(s).name);
  });
});

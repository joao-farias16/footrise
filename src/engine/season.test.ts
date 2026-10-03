import { describe, expect, it } from 'vitest';
import { getClub, getLeague } from '../data/clubs';
import { outcomeProbs } from './match';
import { Rng } from './rng';
import { seasonLabel, simulateSeason } from './season';
import { hubCareer, withAttributes } from './testUtils';

describe('simulação de temporada', () => {
  it('gera estatísticas coerentes', () => {
    const c = hubCareer('ATA', 5);
    const { record } = simulateSeason(c, new Rng(10));
    expect(record.season).toBe(seasonLabel(c.year));
    expect(record.starts).toBeLessThanOrEqual(record.apps);
    expect(record.goals).toBeGreaterThanOrEqual(record.leagueGoals);
    expect(record.minutes).toBeLessThanOrEqual(record.apps * 90);
    expect(record.leaguePos).toBeGreaterThanOrEqual(1);
    expect(record.leaguePos).toBeLessThanOrEqual(record.leagueSize);
    if (record.apps > 0) {
      expect(record.rating).toBeGreaterThan(3.5);
      expect(record.rating).toBeLessThanOrEqual(10);
    }
    expect(record.competitions.length).toBeGreaterThanOrEqual(2);
  });

  it('é determinística para a mesma seed', () => {
    const c = hubCareer('MEI', 8);
    expect(simulateSeason(c, new Rng(77)).record).toEqual(simulateSeason(c, new Rng(77)).record);
  });

  it('jogador muito melhor tende a render mais', () => {
    const base = hubCareer('ATA', 3);
    const clubId = 'chelsea';
    const star = withAttributes(base, 93, clubId);
    const weak = withAttributes(base, 70, clubId);
    let starGoals = 0;
    let weakGoals = 0;
    let starApps = 0;
    let weakApps = 0;
    for (let s = 0; s < 25; s++) {
      const a = simulateSeason(star, new Rng(s)).record;
      const b = simulateSeason(weak, new Rng(s)).record;
      starGoals += a.goals;
      weakGoals += b.goals;
      starApps += a.starts;
      weakApps += b.starts;
    }
    expect(starGoals).toBeGreaterThan(weakGoals * 2);
    expect(starApps).toBeGreaterThan(weakApps * 2);
  });

  it('reservas jogam menos', () => {
    const base = hubCareer('MEI', 4);
    const bench = withAttributes(base, 68, 'manchester-city');
    const { record } = simulateSeason(bench, new Rng(1));
    const league = getLeague(getClub('manchester-city')!.leagueId);
    expect(record.starts).toBeLessThan(league.games / 2);
  });

  it('time mais forte vence mais', () => {
    const strong = outcomeProbs(88, 72);
    const even = outcomeProbs(80, 80);
    expect(strong.win).toBeGreaterThan(0.6);
    expect(even.win).toBeCloseTo(even.loss, 5);
    expect(strong.win + strong.draw + strong.loss).toBeCloseTo(1, 5);
  });
});

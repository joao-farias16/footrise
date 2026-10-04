import { describe, expect, it } from 'vitest';
import { getLeague } from '../data/clubs';
import { sanitizeCareer } from '../state/storage';
import { autoplayCareer } from './autoplay';
import { computeAwards, renameLegacyAward, WORLD_AWARD_NAME, type AwardInput } from './awards';
import { buildCareerSummary, sanitizeSummary } from './careerSummary';
import { Rng } from './rng';
import { profile } from './testUtils';

/** Temporada de um atacante titular numa liga forte. */
function season(over: Partial<AwardInput> = {}): AwardInput {
  return {
    season: '2030/31',
    age: 26,
    ovr: 92,
    position: 'ATA',
    league: getLeague('esp'),
    leaguePos: 1,
    apps: 50,
    starts: 46,
    minutes: 4000,
    goals: 40,
    leagueGoals: 28,
    assists: 12,
    cleanSheets: 0,
    rating: 7.7,
    trophyKinds: ['league', 'continental'],
    continentalPrestige: 1,
    internationalBonus: 4,
    ...over,
  };
}

/** Carreira simulada (seed 3) com várias Bolas de Ouro, inclusive seguidas. Simulada uma única vez. */
let cached: ReturnType<typeof autoplayCareer> | undefined;
function champion() {
  cached ??= autoplayCareer(profile('ATA'), 3);
  return structuredClone(cached);
}

function winRate(input: AwardInput, runs = 2000): number {
  let wins = 0;
  for (let i = 1; i <= runs; i++) {
    const world = computeAwards(input, new Rng(i)).filter((a) => a.kind === 'world');
    expect(world.length).toBeLessThanOrEqual(1);
    if (world.length) wins++;
  }
  return wins / runs;
}

describe('Bola de Ouro', () => {
  it('uma temporada excepcional dá a Bola de Ouro, com esse nome e uma única vez', () => {
    const awards = computeAwards(season(), new Rng(3));
    const world = awards.filter((a) => a.kind === 'world');
    expect(world).toEqual([{ kind: 'world', name: 'Bola de Ouro', season: '2030/31' }]);
    expect(winRate(season())).toBeGreaterThan(0.9);
  });

  it('é decidida pela temporada, não só pelo OVR', () => {
    const extraordinary91 = season({ ovr: 91 });
    const mediocre94 = season({ ovr: 94, rating: 6.9, goals: 14, leagueGoals: 9, assists: 5, leaguePos: 4, trophyKinds: [], internationalBonus: 0 });
    expect(winRate(extraordinary91)).toBeGreaterThan(winRate(mediocre94) + 0.5);
    // Com a mesma temporada, o OVR maior dá vantagem natural.
    expect(winRate(season({ ovr: 94, rating: 7.3 }))).toBeGreaterThanOrEqual(winRate(season({ ovr: 86, rating: 7.3 })));
    // Sem jogos suficientes, não há prêmio, por maior que seja o OVR.
    expect(winRate(season({ ovr: 97, starts: 10, apps: 12, minutes: 900 }))).toBe(0);
  });

  it('pode ser conquistada várias vezes, inclusive seguidas, e fica no histórico', () => {
    const c = champion();
    const won = c.awards.filter((a) => a.kind === 'world');
    expect(won.length).toBeGreaterThan(1);
    const years = won.map((a) => Number(a.season.slice(0, 4)));
    expect(years.some((y, i) => i > 0 && y === years[i - 1] + 1)).toBe(true);
    for (const a of won) {
      expect(a.name).toBe(WORLD_AWARD_NAME);
      const rec = c.seasons.find((s) => s.season === a.season)!;
      // Uma por temporada, registrada na temporada e nas manchetes.
      expect(rec.awards.filter((x) => x.kind === 'world')).toHaveLength(1);
      expect(rec.headlines).toContain(`🥇 ${WORLD_AWARD_NAME}`);
    }
    const summary = buildCareerSummary(c);
    expect(summary.awards.filter((a) => a.kind === 'world')).toHaveLength(won.length);
  });

  it('existe uma única premiação de melhor do mundo (sem a antiga Coroa de Ouro)', () => {
    const c = champion();
    const names = new Set(c.awards.filter((a) => a.kind === 'world').map((a) => a.name));
    expect([...names]).toEqual([WORLD_AWARD_NAME]);
    expect(c.awards.some((a) => /coroa/i.test(a.name))).toBe(false);
  });

  it('saves e resumos antigos com "Coroa de Ouro FootRise" passam a mostrar Bola de Ouro', () => {
    expect(renameLegacyAward('🥇 Coroa de Ouro FootRise')).toBe('🥇 Bola de Ouro');
    expect(renameLegacyAward('Artilheiro da Liga Espanhola')).toBe('Artilheiro da Liga Espanhola');

    const c = champion();
    const old = JSON.parse(JSON.stringify(c).replaceAll(WORLD_AWARD_NAME, 'Coroa de Ouro FootRise'));
    const migrated = sanitizeCareer(old)!;
    expect(migrated).toEqual(c);

    const json = JSON.stringify(buildCareerSummary(c));
    const summary = sanitizeSummary(JSON.parse(json.replaceAll(WORLD_AWARD_NAME, 'Coroa de Ouro FootRise')))!;
    expect(JSON.stringify(summary)).not.toContain('Coroa de Ouro');
    expect(summary).toEqual(sanitizeSummary(JSON.parse(json)));
  });
});

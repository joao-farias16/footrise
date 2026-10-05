import { describe, expect, it } from 'vitest';
import { getLeague } from '../data/clubs';
import { sanitizeCareer } from '../state/storage';
import { autoplayCareer } from './autoplay';
import { computeAwards, renameLegacyAward, worldCandidacy, WORLD_AWARD_NAME, type AwardInput } from './awards';
import { buildCareerSummary, sanitizeSummary } from './careerSummary';
import { Rng } from './rng';
import { profile } from './testUtils';

/** Temporada extraordinária de um atacante titular numa liga forte, campeão da liga e continental. */
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
    goals: 42,
    leagueGoals: 29,
    assists: 16,
    cleanSheets: 0,
    rating: 8.15,
    trophyKinds: ['league', 'continental'],
    continentalPrestige: 1,
    internationalBonus: 8,
    ...over,
  };
}

/** Temporada de goleiro: sem gols, a candidatura vem da nota, dos jogos sem sofrer gols e dos títulos. */
function keeper(over: Partial<AwardInput> = {}): AwardInput {
  return season({ position: 'GOL', goals: 0, leagueGoals: 0, assists: 0, cleanSheets: 18, rating: 7.45, ovr: 89, trophyKinds: ['league', 'cup'], internationalBonus: 2, ...over });
}

/** Carreira de superestrela simulada com várias Bolas de Ouro, inclusive seguidas. Simulada uma única vez. */
let cached: ReturnType<typeof autoplayCareer> | undefined;
function champion() {
  cached ??= autoplayCareer(profile('ATA'), 182150);
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
    expect(winRate(season())).toBeGreaterThan(0.85);
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

describe('Bola de Ouro — cenários de temporada', () => {
  it('A: atacante com temporada extraordinária e título continental é um dos grandes favoritos', () => {
    expect(winRate(season())).toBeGreaterThan(0.85);
  });

  it('B: atacante de muitos gols, nota só boa e poucos títulos compete, mas não ganha automaticamente', () => {
    const b = season({ goals: 45, leagueGoals: 31, assists: 12, rating: 7.8, trophyKinds: ['league'], internationalBonus: 4, ovr: 91 });
    const rate = winRate(b);
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.5);
  });

  it('C: meia com nota excelente, muitos gols/assistências e título importante consegue vencer', () => {
    const c = season({ position: 'MEI', goals: 20, leagueGoals: 13, assists: 22, rating: 8.1, internationalBonus: 6 });
    expect(winRate(c)).toBeGreaterThan(0.6);
  });

  it('D: defensor excepcional, com muitos jogos sem sofrer gols e título continental, tem chance real', () => {
    const d = season({ position: 'ZAG', goals: 5, leagueGoals: 3, assists: 3, cleanSheets: 26, rating: 7.85, internationalBonus: 6 });
    const rate = winRate(d);
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(winRate(season()));
  });

  it('E: goleiro numa temporada histórica (continental + Copa do Mundo) é capaz de vencer', () => {
    const e = keeper({ cleanSheets: 28, rating: 7.9, ovr: 92, trophyKinds: ['league', 'continental', 'worldCup'], internationalBonus: 8 });
    expect(winRate(e)).toBeGreaterThan(0.5);
  });

  it('F: goleiro com uma boa temporada e alguns títulos não é favorecido para equilibrar posições', () => {
    expect(winRate(keeper())).toBeLessThan(0.02);
    // Mesmo campeão continental, uma temporada apenas boa não basta.
    expect(winRate(keeper({ trophyKinds: ['league', 'continental'] }))).toBeLessThan(0.05);
  });

  it('G: OVR 95+ com temporada mediana não ganha', () => {
    const g = season({ ovr: 96, rating: 7.3, goals: 14, leagueGoals: 9, assists: 6, trophyKinds: [], internationalBonus: 0 });
    expect(winRate(g)).toBeLessThan(0.01);
  });

  it('H: temporada histórica tem chance muito alta independentemente da posição', () => {
    const all: AwardInput['trophyKinds'] = ['league', 'continental', 'worldCup'];
    const historic: AwardInput[] = [
      season({ goals: 48, leagueGoals: 33, assists: 18, rating: 8.3, trophyKinds: all, internationalBonus: 10 }),
      season({ position: 'MEI', goals: 25, leagueGoals: 16, assists: 28, rating: 8.3, trophyKinds: all, internationalBonus: 10 }),
      season({ position: 'ZAG', goals: 8, leagueGoals: 5, assists: 6, cleanSheets: 27, rating: 8.1, ovr: 93, trophyKinds: all, internationalBonus: 10 }),
      keeper({ cleanSheets: 30, rating: 8.0, ovr: 93, trophyKinds: all, internationalBonus: 10 }),
    ];
    for (const h of historic) expect(winRate(h)).toBeGreaterThan(0.7);
  });
});

describe('Bola de Ouro — sanidade dos critérios', () => {
  it('gols sozinhos não bastam', () => {
    expect(winRate(season({ goals: 50, leagueGoals: 35, assists: 5, rating: 7.3, trophyKinds: [], internationalBonus: 0 }))).toBeLessThan(0.02);
  });

  it('títulos sozinhos não bastam', () => {
    const passenger = season({ goals: 8, leagueGoals: 5, assists: 5, rating: 7.0, trophyKinds: ['league', 'cup', 'continental', 'clubWorld', 'worldCup'], internationalBonus: 0 });
    expect(winRate(passenger)).toBeLessThan(0.02);
  });

  it('OVR sozinho não basta', () => {
    expect(winRate(season({ ovr: 99, rating: 7.2, goals: 15, leagueGoals: 10, assists: 6, trophyKinds: [], internationalBonus: 0 }))).toBeLessThan(0.02);
  });

  it('nota média excepcional pesa muito', () => {
    const numbers = { goals: 28, leagueGoals: 19, assists: 12, trophyKinds: ['league'] as AwardInput['trophyKinds'] };
    expect(winRate(season({ ...numbers, rating: 8.2 }))).toBeGreaterThan(winRate(season({ ...numbers, rating: 7.6 })) + 0.4);
  });

  it('títulos importantes dão um impulso significativo à mesma temporada', () => {
    const numbers = { goals: 35, leagueGoals: 24, assists: 14, rating: 7.9, internationalBonus: 5 };
    const without = winRate(season({ ...numbers, trophyKinds: [] }));
    const withContinental = winRate(season({ ...numbers, trophyKinds: ['league', 'continental'] }));
    expect(withContinental).toBeGreaterThan(without + 0.3);
  });

  it('uma temporada histórica de goleiro/defensor supera uma boa temporada de atacante', () => {
    const goodForward = season({ goals: 30, leagueGoals: 21, assists: 12, rating: 7.75, trophyKinds: ['league'], internationalBonus: 4, ovr: 91 });
    const historicKeeper = keeper({ cleanSheets: 28, rating: 7.9, ovr: 92, trophyKinds: ['league', 'continental', 'worldCup'], internationalBonus: 8 });
    const historicDefender = season({ position: 'ZAG', goals: 6, leagueGoals: 4, assists: 4, cleanSheets: 26, rating: 7.95, trophyKinds: ['league', 'continental'], internationalBonus: 8 });
    expect(worldCandidacy(historicKeeper)).toBeGreaterThan(worldCandidacy(goodForward));
    expect(worldCandidacy(historicDefender)).toBeGreaterThan(worldCandidacy(goodForward));
  });

  it('sem bônus por posição: temporadas do mesmo nível relativo favorecem quem decide com gols', () => {
    // Temporadas no 90º percentil de cada posição nas simulações do jogo, todas campeãs da liga.
    const common = { trophyKinds: ['league'] as AwardInput['trophyKinds'], internationalBonus: 3, ovr: 91 };
    const forward = season({ ...common, goals: 26, leagueGoals: 18, assists: 19, rating: 7.74 });
    const midfielder = season({ ...common, position: 'MEI', goals: 19, leagueGoals: 12, assists: 20, rating: 7.67 });
    const defender = season({ ...common, position: 'ZAG', goals: 4, leagueGoals: 3, assists: 6, cleanSheets: 17, rating: 7.6 });
    const gk = keeper({ ...common, cleanSheets: 20, rating: 7.55 });
    const [f, m, d, k] = [forward, midfielder, defender, gk].map(worldCandidacy);
    expect(f).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(d);
    expect(d).toBeGreaterThan(k);
  });

  it('poucos jogos derrubam a candidatura', () => {
    expect(winRate(season({ apps: 30, starts: 24, minutes: 2000 }))).toBeLessThan(winRate(season()) - 0.5);
    expect(winRate(season({ apps: 20, starts: 15, minutes: 1300 }))).toBe(0);
  });

  it('uma temporada mediana não dá a Bola de Ouro', () => {
    expect(winRate(season({ goals: 15, leagueGoals: 10, assists: 8, rating: 7.2, trophyKinds: ['league'], internationalBonus: 1, ovr: 88 }))).toBe(0);
  });

  it('temporadas muito boas podem perder para um rival melhor e ficar vários anos sem prêmio', () => {
    const rate = winRate(season({ goals: 30, leagueGoals: 21, assists: 14, rating: 7.85, trophyKinds: ['league'], internationalBonus: 4 }));
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.6);
    // Com esse nível, três anos seguidos sem vencer acontecem com frequência.
    expect((1 - rate) ** 3).toBeGreaterThan(0.1);
  });

  it('ganhar várias vezes exige temporadas excepcionais em sequência', () => {
    // Dez temporadas apenas excelentes rendem poucas Bolas; dez extraordinárias, várias — mas raramente todas.
    const excellent = winRate(season({ goals: 32, leagueGoals: 22, assists: 14, rating: 7.95, trophyKinds: ['league'], internationalBonus: 5 }));
    const extraordinary = winRate(season());
    expect(excellent * 10).toBeLessThan(6);
    expect(extraordinary * 10).toBeGreaterThan(6);
    expect(extraordinary ** 10).toBeLessThan(0.5);
  });
});

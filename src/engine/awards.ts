import { AWARDS } from '../config/balance';
import { POSITIONS } from '../config/positions';
import type { Award, League, PositionId, TrophyKind } from '../types';
import type { Rng } from './rng';

/** Prêmio anual de melhor jogador do mundo (antes chamado "Coroa de Ouro FootRise"). */
export const WORLD_AWARD_NAME = 'Bola de Ouro';
const LEGACY_WORLD_AWARD_NAMES = ['Coroa de Ouro FootRise'];

/** Troca o nome antigo da Bola de Ouro em textos de saves e resumos anteriores (prêmios e manchetes). */
export function renameLegacyAward(text: string): string {
  return LEGACY_WORLD_AWARD_NAMES.reduce((t, old) => t.replaceAll(old, WORLD_AWARD_NAME), text);
}

export interface AwardInput {
  season: string;
  age: number;
  ovr: number;
  position: PositionId;
  league: League;
  leaguePos: number;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  leagueGoals: number;
  assists: number;
  cleanSheets: number;
  rating: number;
  trophyKinds: TrophyKind[];
  continentalPrestige: number;
  /** Desempenho pela seleção na temporada (gols, assistências, nota). */
  internationalBonus?: number;
}

/** Índice de desempenho da temporada (≈ 0 mediano, 50+ excepcional). */
export function performanceScore(
  i: Omit<AwardInput, 'season' | 'league' | 'trophyKinds' | 'continentalPrestige' | 'leaguePos' | 'leagueGoals' | 'age' | 'internationalBonus'>,
): number {
  if (i.apps === 0) return -30;
  const group = POSITIONS[i.position].group;
  const contribution =
    group === 'gk' || group === 'def'
      ? i.cleanSheets * 0.3 + (i.goals + i.assists) * 0.4
      : (i.goals + i.assists * 0.7) * 0.28;
  const minutesPenalty = i.minutes < 2200 ? (2200 - i.minutes) / 90 : 0;
  return (i.rating - 6.6) * 30 + (i.ovr - 78) * 0.8 + Math.min(14, contribution) - minutesPenalty;
}

const TITLE_WEIGHT: Record<TrophyKind, number> = {
  league: 5,
  cup: 2,
  continental: 12,
  clubWorld: 2,
  worldCup: 15,
  continentalNation: 8,
  nationsLeague: 3,
};

export function computeAwards(i: AwardInput, rng: Rng): Award[] {
  const awards: Award[] = [];
  const perf = performanceScore(i);
  const enoughGames = i.starts >= AWARDS.minStartsForAwards;
  const isKeeper = i.position === 'GOL';

  if (!isKeeper) {
    const rivalGoals = Math.round(i.league.topScorerGoals + rng.normal(0, AWARDS.topScorerNoise));
    if (i.leagueGoals >= Math.max(AWARDS.minTopScorerGoals, rivalGoals)) {
      awards.push({ kind: 'topScorer', name: `Artilheiro da ${i.league.name}`, season: i.season });
    }
  } else if (enoughGames && i.cleanSheets >= i.apps * 0.4 && perf + rng.normal(0, 4) >= 12) {
    awards.push({ kind: 'bestKeeper', name: `Melhor goleiro da ${i.league.name}`, season: i.season });
  }

  if (enoughGames && perf >= AWARDS.clubPlayerPerf + rng.normal(0, 3)) {
    awards.push({ kind: 'clubPlayer', name: 'Craque do clube na temporada', season: i.season });
  }

  const leagueBonus = i.leaguePos === 1 ? 5 : 0;
  if (enoughGames && perf + leagueBonus >= AWARDS.leaguePlayerRival + rng.normal(0, AWARDS.rivalNoise)) {
    awards.push({ kind: 'leaguePlayer', name: `Melhor jogador da ${i.league.name}`, season: i.season });
  }

  if (i.age <= AWARDS.bestYoungMaxAge && enoughGames && perf >= 14 + rng.normal(0, 4)) {
    awards.push({ kind: 'bestYoung', name: 'Prêmio Revelação Mundial', season: i.season });
  }

  const titles = i.trophyKinds.reduce(
    (s, k) => s + (k === 'continental' ? TITLE_WEIGHT[k] * i.continentalPrestige : TITLE_WEIGHT[k]),
    0,
  );
  const worldScore = perf + titles + (i.league.strength - 80) * 0.8 + (i.internationalBonus ?? 0);
  if (enoughGames && worldScore >= AWARDS.worldRival + rng.normal(0, AWARDS.rivalNoise)) {
    awards.push({ kind: 'world', name: WORLD_AWARD_NAME, season: i.season });
  }

  return awards;
}

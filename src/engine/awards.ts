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

/**
 * Peso de cada título na candidatura à Bola de Ouro. As grandes conquistas (continental,
 * Copa do Mundo) dão o maior impulso; copas menores quase não contam.
 */
const WORLD_TITLE_WEIGHT: Record<TrophyKind, number> = {
  league: 7,
  cup: 2,
  continental: 22,
  clubWorld: 2,
  worldCup: 24,
  continentalNation: 13,
  nationsLeague: 2,
};

/**
 * Números da temporada lidos de acordo com a posição: gols e assistências para quem ataca,
 * jogos sem sofrer gols para quem defende. Sem bônus por posição — cada uma só pontua
 * pelo que de fato produz, e o retorno diminui a partir de uma produção já excelente.
 */
function worldProduction(i: AwardInput): number {
  const group = POSITIONS[i.position].group;
  const raw =
    group === 'att'
      ? i.goals + i.assists * 0.75
      : group === 'mid'
        ? (i.goals + i.assists) * 0.8
        : group === 'def'
          ? i.cleanSheets * 0.55 + i.goals * 0.8 + i.assists * 0.6
          : i.cleanSheets * 0.8;
  return Math.min(40, Math.min(raw, 30) * 0.8 + Math.max(0, raw - 30) * 0.4);
}

/**
 * Candidatura à Bola de Ouro (≈ 100 é o nível de um vencedor típico; 140+ uma temporada histórica).
 * Responde "foi uma temporada de melhor do mundo?": a nota média pesa mais que tudo e cresce
 * mais rápido quando é excepcional; números, títulos (só contam por inteiro para quem foi
 * protagonista), seleção e força da liga completam; o OVR é apenas apoio.
 */
export function worldCandidacy(i: AwardInput): number {
  if (i.apps === 0) return -Infinity;
  const rating = (i.rating - 7) * 55 + Math.max(0, i.rating - 7.6) * 45;
  const protagonism = Math.min(1, Math.max(0, (i.rating - 6.9) / 0.6));
  const titles =
    Math.min(
      50,
      i.trophyKinds.reduce((s, k) => s + WORLD_TITLE_WEIGHT[k] * (k === 'continental' ? i.continentalPrestige : 1), 0),
    ) * protagonism;
  const league = (i.league.strength - 82) * 0.6;
  const ovr = (i.ovr - 88) * 0.8;
  // Temporada incompleta derruba a candidatura: alguns jogos a menos pesam pouco, meia temporada é decisiva.
  const availability = -((Math.max(0, 3000 - i.minutes) / 100) ** 2) * 0.7;
  return rating + worldProduction(i) + titles + (i.internationalBonus ?? 0) + league + ovr + availability;
}

/** Melhor temporada entre os outros candidatos do mundo no ano (cada um com sua variação). */
function bestRivalSeason(rng: Rng): number {
  return Math.max(...AWARDS.worldRivals.map((r) => r.base + rng.normal(0, r.sd)));
}

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

  if (enoughGames && worldCandidacy(i) > bestRivalSeason(rng)) {
    awards.push({ kind: 'world', name: WORLD_AWARD_NAME, season: i.season });
  }

  return awards;
}

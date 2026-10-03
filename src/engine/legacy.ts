import { LEGACY_TIERS } from '../config/balance';
import { POSITIONS, type PositionGroup } from '../config/positions';
import { CLUB_BY_ID, CONTINENTAL_CUP } from '../data/clubs';
import type { Award, AwardKind, Career, LegacyBreakdown, LegacyResult, Trophy, TrophyKind } from '../types';
import { clamp } from './rng';

export const LEGACY_WEIGHTS = {
  peak: 20,
  longevity: 8,
  production: 12,
  titles: 17,
  bigTitles: 10,
  awards: 12,
  national: 10,
  clubLevel: 6,
  consistency: 5,
} as const;

const TITLE_POINTS: Record<TrophyKind, number> = {
  league: 3,
  cup: 1,
  continental: 6,
  clubWorld: 2,
  worldCup: 10,
  continentalNation: 5,
  nationsLeague: 2,
};

const AWARD_POINTS: Record<AwardKind, number> = {
  world: 10,
  leaguePlayer: 3,
  topScorer: 2,
  bestKeeper: 2,
  bestYoung: 1.5,
  clubPlayer: 0.5,
  tournamentBest: 3,
  tournamentTopScorer: 1.5,
};

/** Pontos de campanha em grandes torneios de seleção (participação no elenco). */
const TOURNAMENT_RUN: Record<string, number> = {
  Campeão: 1,
  'Vice-campeão': 0.7,
  Semifinal: 0.5,
  'Quartas de final': 0.3,
  'Oitavas de final': 0.15,
  '16 avos de final': 0.1,
};

/** Produção esperada de uma carreira de elite, por grupo de posição. */
const PRODUCTION_SCALE: Record<PositionGroup, number> = { att: 450, mid: 300, def: 170, gk: 230 };
const NATIONAL_GOAL_SCALE: Record<PositionGroup, number> = { att: 40, mid: 20, def: 8, gk: 0 };

function continentalPrestige(t: Trophy): number {
  const entry = Object.values(CONTINENTAL_CUP).find((c) => c.name === t.name);
  return entry?.prestige ?? 1;
}

export interface LegacyInput {
  peakOvr: number;
  position: Career['position'];
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  trophies: Trophy[];
  awards: Award[];
  nationalCaps: number;
  nationalGoals: number;
  playedWorldCup: boolean;
  /** Assistências pela seleção (opcional em entradas antigas). */
  nationalAssists?: number;
  /** Copas do Mundo disputadas no elenco. */
  worldCups?: number;
  /** Soma ponderada das campanhas em Copa do Mundo (peso 2) e torneios continentais (peso 1). */
  tournamentRuns?: number;
  /** Força média dos clubes, ponderada por minutos. */
  avgClubStrength: number;
  goodSeasons: number;
  totalSeasons: number;
}

export function legacyInputFromCareer(c: Career): LegacyInput {
  const totals = c.seasons.reduce(
    (acc, s) => {
      acc.apps += s.apps;
      acc.goals += s.goals;
      acc.assists += s.assists;
      acc.cleanSheets += s.cleanSheets;
      const strength = CLUB_BY_ID[s.clubId]?.strength ?? 65;
      acc.strengthMinutes += strength * s.minutes;
      acc.minutes += s.minutes;
      if (s.apps >= 10) acc.counted++;
      if (s.apps >= 20 && s.rating >= 7.0) acc.good++;
      return acc;
    },
    { apps: 0, goals: 0, assists: 0, cleanSheets: 0, strengthMinutes: 0, minutes: 0, counted: 0, good: 0 },
  );
  return {
    peakOvr: c.peakOvr,
    position: c.position,
    apps: totals.apps,
    goals: totals.goals,
    assists: totals.assists,
    cleanSheets: totals.cleanSheets,
    trophies: c.trophies,
    awards: c.awards,
    nationalCaps: c.national.caps,
    nationalGoals: c.national.goals,
    playedWorldCup: c.national.tournaments.some((t) => t.name === 'Copa do Mundo'),
    nationalAssists: c.national.assists ?? 0,
    worldCups: c.national.tournaments.filter((t) => t.name === 'Copa do Mundo').length,
    tournamentRuns: c.national.tournaments.reduce(
      (s, t) => s + (TOURNAMENT_RUN[t.result] ?? 0) * (t.name === 'Copa do Mundo' ? 2 : 1),
      0,
    ),
    avgClubStrength: totals.minutes > 0 ? totals.strengthMinutes / totals.minutes : 60,
    goodSeasons: totals.good,
    totalSeasons: Math.max(1, totals.counted),
  };
}

export function legacyTier(score: number): { name: string; description: string } {
  return LEGACY_TIERS.find((t) => score >= t.min) ?? LEGACY_TIERS[LEGACY_TIERS.length - 1];
}

export function computeLegacy(i: LegacyInput): LegacyResult {
  const group = POSITIONS[i.position].group;
  const W = LEGACY_WEIGHTS;

  const peak = clamp((i.peakOvr - 65) / 29, 0, 1) ** 1.1;
  const longevity = clamp(i.apps / 650, 0, 1);

  const contributions =
    group === 'gk'
      ? i.cleanSheets + i.assists
      : group === 'def'
        ? i.goals + i.assists * 0.75 + i.cleanSheets * 0.5
        : i.goals + i.assists * 0.75;
  const production = clamp(contributions / PRODUCTION_SCALE[group], 0, 1) ** 0.8;

  const titlePts = i.trophies.reduce(
    (s, t) => s + TITLE_POINTS[t.kind] * (t.kind === 'continental' ? continentalPrestige(t) : 1),
    0,
  );
  const titles = 1 - Math.exp(-titlePts / 30);

  const bigPts = i.trophies.reduce((s, t) => {
    if (t.kind === 'continental') return s + continentalPrestige(t);
    if (t.kind === 'worldCup') return s + 2.5;
    if (t.kind === 'continentalNation') return s + 0.8;
    if (t.kind === 'nationsLeague') return s + 0.25;
    if (t.kind === 'clubWorld') return s + 0.3;
    return s;
  }, 0);
  const bigTitles = 1 - Math.exp(-bigPts / 2.5);

  const awardPts = i.awards.reduce((s, a) => s + AWARD_POINTS[a.kind], 0);
  const awards = 1 - Math.exp(-awardPts / 22);

  // Seleção: presença (jogos), produção, Copas disputadas e campanhas nos grandes torneios.
  const goalScale = NATIONAL_GOAL_SCALE[group];
  const caps = clamp(i.nationalCaps / 100, 0, 1);
  const natProduction =
    group === 'gk' || goalScale === 0 ? caps : clamp((i.nationalGoals + (i.nationalAssists ?? 0) * 0.6) / goalScale, 0, 1);
  const worldCups = i.worldCups !== undefined ? clamp(i.worldCups / 3, 0, 1) : i.playedWorldCup ? 0.34 : 0;
  const runs = clamp((i.tournamentRuns ?? 0) / 4, 0, 1);
  const national = caps * 0.4 + natProduction * 0.2 + worldCups * 0.2 + runs * 0.2;

  const clubLevel = clamp((i.avgClubStrength - 65) / 25, 0, 1);
  const consistency = clamp(i.goodSeasons / i.totalSeasons, 0, 1);

  const breakdown: LegacyBreakdown[] = [
    { key: 'peak', label: 'Pico de overall', points: peak * W.peak, max: W.peak },
    { key: 'titles', label: 'Títulos', points: titles * W.titles, max: W.titles },
    { key: 'production', label: 'Produção em campo', points: production * W.production, max: W.production },
    { key: 'awards', label: 'Prêmios individuais', points: awards * W.awards, max: W.awards },
    { key: 'bigTitles', label: 'Títulos gigantes', points: bigTitles * W.bigTitles, max: W.bigTitles },
    { key: 'longevity', label: 'Longevidade', points: longevity * W.longevity, max: W.longevity },
    { key: 'national', label: 'Seleção', points: national * W.national, max: W.national },
    { key: 'clubLevel', label: 'Nível dos clubes', points: clubLevel * W.clubLevel, max: W.clubLevel },
    { key: 'consistency', label: 'Consistência', points: consistency * W.consistency, max: W.consistency },
  ].map((b) => ({ ...b, points: Math.round(b.points * 10) / 10 }));

  const score = clamp(Math.round(breakdown.reduce((s, b) => s + b.points, 0)), 0, 100);
  const tier = legacyTier(score);
  return { score, tier: tier.name, tierDescription: tier.description, breakdown };
}

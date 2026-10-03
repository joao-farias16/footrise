import { getClub } from '../data/clubs';
import type { Career, SeasonRecord, TrophyKind } from '../types';
import { currentOverall } from './career';

export interface CareerTotals {
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  seasons: number;
  trophies: number;
  awards: number;
  avgRating: number;
}

export function careerTotals(c: Career): CareerTotals {
  const t = c.seasons.reduce(
    (acc, s) => {
      acc.apps += s.apps;
      acc.goals += s.goals;
      acc.assists += s.assists;
      acc.cleanSheets += s.cleanSheets;
      acc.ratingSum += s.rating * s.apps;
      return acc;
    },
    { apps: 0, goals: 0, assists: 0, cleanSheets: 0, ratingSum: 0 },
  );
  return {
    apps: t.apps,
    goals: t.goals,
    assists: t.assists,
    cleanSheets: t.cleanSheets,
    seasons: c.seasons.length,
    trophies: c.trophies.length,
    awards: c.awards.length,
    avgRating: t.apps > 0 ? t.ratingSum / t.apps : 0,
  };
}

export function trophyCounts(c: Career): { name: string; kind: TrophyKind; count: number }[] {
  const map = new Map<string, { name: string; kind: TrophyKind; count: number }>();
  for (const t of c.trophies) {
    const e = map.get(t.name) ?? { name: t.name, kind: t.kind, count: 0 };
    e.count++;
    map.set(t.name, e);
  }
  const order: TrophyKind[] = ['worldCup', 'continental', 'clubWorld', 'continentalNation', 'nationsLeague', 'league', 'cup'];
  return [...map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.count - a.count);
}

export interface NationalSummary {
  callups: number;
  caps: number;
  starts: number;
  goals: number;
  assists: number;
  debutSeason?: string;
  titles: { kind: TrophyKind; name: string; year: number }[];
  worldCups: { year: number; result: string }[];
  continental: { name: string; year: number; result: string }[];
}

/** Resumo da carreira pela seleção (funciona também com saves antigos). */
export function nationalSummary(c: Career): NationalSummary {
  const n = c.national;
  const year = (season: string) => Number(season.slice(0, 4)) + 1;
  return {
    callups: n.callups ?? c.seasons.filter((s) => s.national.calledUp).length,
    caps: n.caps,
    starts: n.starts ?? 0,
    goals: n.goals,
    assists: n.assists ?? 0,
    debutSeason: n.debutSeason,
    titles: c.trophies.filter((t) => t.team === 'Seleção').map((t) => ({ kind: t.kind, name: t.name, year: year(t.season) })),
    worldCups: n.tournaments.filter((t) => t.name === 'Copa do Mundo').map((t) => ({ year: year(t.season), result: t.result })),
    continental: n.tournaments.filter((t) => t.name !== 'Copa do Mundo').map((t) => ({ name: t.name, year: year(t.season), result: t.result })),
  };
}

/** Pontuação simples para eleger a melhor temporada. */
export function seasonScore(s: SeasonRecord): number {
  return s.rating * 10 + s.goals * 0.6 + s.assists * 0.4 + s.cleanSheets * 0.3 + s.trophies.length * 4 + s.awards.length * 5;
}

export function bestSeason(c: Career): SeasonRecord | undefined {
  return c.seasons.filter((s) => s.apps > 0).reduce<SeasonRecord | undefined>((b, s) => (!b || seasonScore(s) > seasonScore(b) ? s : b), undefined);
}

export interface ClubSpell {
  clubId: string;
  name: string;
  colors: [string, string];
  from: string;
  to: string;
  seasons: number;
  apps: number;
  goals: number;
  trophies: number;
  loan: boolean;
}

/** Passagens por clube (temporadas consecutivas no mesmo clube são agrupadas). */
export function clubSpells(c: Career): ClubSpell[] {
  const spells: ClubSpell[] = [];
  for (const s of c.seasons) {
    const last = spells[spells.length - 1];
    if (last && last.clubId === s.clubId) {
      last.to = s.season;
      last.seasons++;
      last.apps += s.apps;
      last.goals += s.goals;
      last.trophies += s.trophies.filter((t) => t.team !== 'Seleção').length;
    } else {
      const club = getClub(s.clubId);
      spells.push({
        clubId: s.clubId,
        name: s.clubName,
        colors: club?.colors ?? ['#334155', '#e2e8f0'],
        from: s.season,
        to: s.season,
        seasons: 1,
        apps: s.apps,
        goals: s.goals,
        trophies: s.trophies.filter((t) => t.team !== 'Seleção').length,
        loan: s.loan,
      });
    }
  }
  return spells;
}

/** Clube com mais jogos na carreira. */
export function mainClub(c: Career): string {
  const apps = new Map<string, number>();
  for (const s of c.seasons) apps.set(s.clubName, (apps.get(s.clubName) ?? 0) + s.apps);
  let best = '—';
  let max = -1;
  for (const [name, n] of apps) if (n > max) [best, max] = [name, n];
  return best;
}

export function biggestTransfer(c: Career) {
  return c.transfers.filter((t) => t.kind === 'transfer').reduce<Career['transfers'][number] | undefined>((b, t) => (!b || t.fee > b.fee ? t : b), undefined);
}

export interface HistoryEntry {
  id: string;
  name: string;
  nationality: string;
  position: Career['position'];
  peakOvr: number;
  finalOvr: number;
  legacyScore: number;
  legacyTier: string;
  goals: number;
  trophies: number;
  mainClub: string;
  retiredAt: number;
  finalAge: number;
}

export function historyEntry(c: Career): HistoryEntry {
  const totals = careerTotals(c);
  return {
    id: c.id,
    name: c.profile.name,
    nationality: c.profile.nationality,
    position: c.position,
    peakOvr: c.peakOvr,
    finalOvr: currentOverall(c),
    legacyScore: c.legacy?.score ?? 0,
    legacyTier: c.legacy?.tier ?? '—',
    goals: totals.goals,
    trophies: totals.trophies,
    mainClub: mainClub(c),
    retiredAt: c.updatedAt,
    finalAge: c.age,
  };
}

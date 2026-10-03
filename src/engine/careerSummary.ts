import { attrKeysFor, attrsByImportance } from '../config/positions';
import { getClub } from '../data/clubs';
import { getCountry } from '../data/countries';
import type { Career, CareerSummary, ClubSpellSummary, DetailStats, SeasonSummary } from '../types';
import { computeLegacy, legacyInputFromCareer } from './legacy';
import { computeOverall } from './overall';
import { shirtHistory } from './shirt';
import { deriveStyle } from './style';
import { nationalSummary } from './summary';

// Resumo de uma carreira encerrada: tudo o que o histórico precisa mostrar, calculado a partir
// do que o simulador registrou (temporadas, troféus, transferências...). Nada é inventado aqui.

const endYear = (season: string) => Number(season.slice(0, 4)) + 1;

/** Nota média ponderada pelos jogos (a nota de cada temporada já é a média das partidas). */
export function weightedRating(rows: { rating: number; apps: number }[]): number {
  const apps = rows.reduce((s, r) => s + r.apps, 0);
  if (apps === 0) return 0;
  return Math.round((rows.reduce((s, r) => s + r.rating * r.apps, 0) / apps) * 100) / 100;
}

function emptyDetail(): DetailStats {
  return { shots: 0, keyPasses: 0, tackles: 0, interceptions: 0, clearances: 0, saves: 0, conceded: 0 };
}

function clubSpells(c: Career): ClubSpellSummary[] {
  const spells: (ClubSpellSummary & { ratingRows: { rating: number; apps: number }[] })[] = [];
  for (const s of c.seasons) {
    let spell = spells[spells.length - 1];
    if (!spell || spell.clubId !== s.clubId) {
      const club = getClub(s.clubId);
      spell = {
        clubId: s.clubId,
        name: s.clubName,
        country: club?.country ?? '',
        from: s.season,
        to: s.season,
        seasons: 0,
        loan: s.loan,
        apps: 0,
        starts: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        avgRating: 0,
        trophies: [],
        shirtNumbers: [],
        ratingRows: [],
      };
      spells.push(spell);
    }
    spell.to = s.season;
    spell.seasons++;
    spell.loan = spell.loan && s.loan;
    spell.apps += s.apps;
    spell.starts += s.starts;
    spell.minutes += s.minutes;
    spell.goals += s.goals;
    spell.assists += s.assists;
    spell.cleanSheets += s.cleanSheets;
    spell.ratingRows.push({ rating: s.rating, apps: s.apps });
    for (const t of s.trophies) if (t.team !== 'Seleção') spell.trophies.push({ name: t.name, season: t.season });
    const n = s.shirtNumber ?? c.profile.number;
    if (!spell.shirtNumbers.includes(n)) spell.shirtNumbers.push(n);
  }
  return spells.map(({ ratingRows, ...sp }) => ({ ...sp, avgRating: weightedRating(ratingRows) }));
}

function seasonRows(c: Career): SeasonSummary[] {
  return c.seasons.map((s) => ({
    season: s.season,
    year: s.year,
    age: s.age,
    clubId: s.clubId,
    clubName: s.clubName,
    loan: s.loan,
    position: s.position,
    ovrStart: s.ovrStart,
    ovr: s.ovrEnd,
    apps: s.apps,
    starts: s.starts,
    minutes: s.minutes,
    goals: s.goals,
    leagueGoals: s.leagueGoals,
    assists: s.assists,
    cleanSheets: s.cleanSheets,
    rating: s.rating,
    yellow: s.yellow,
    red: s.red,
    leaguePos: s.leaguePos,
    leagueSize: s.leagueSize,
    marketValue: s.marketValue,
    weeklyWage: s.weeklyWage,
    shirtNumber: s.shirtNumber,
    trophies: s.trophies.map((t) => t.name),
    awards: s.awards.map((a) => a.name),
    national: { calledUp: s.national.calledUp, caps: s.national.caps, goals: s.national.goals, assists: s.national.assists ?? 0 },
  }));
}

/** Gera o resumo completo. A carreira deve estar encerrada (fase 'retired'). */
export function buildCareerSummary(c: Career, savedAt = Date.now()): CareerSummary {
  const seasons = c.seasons;
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  const detail = emptyDetail();
  for (const s of seasons) {
    if (!s.detail) continue;
    for (const k of Object.keys(detail) as (keyof DetailStats)[]) detail[k] += s.detail[k] ?? 0;
  }
  const sum = (f: (s: (typeof seasons)[number]) => number) => seasons.reduce((t, s) => t + f(s), 0);
  const keys = attrKeysFor(c.position);
  const peakSeason = seasons.find((s) => s.ovrEnd === c.peakOvr || s.ovrStart === c.peakOvr);
  const n = nationalSummary(c);
  const retirementAge = c.retirementAge ?? c.age;

  return {
    summaryVersion: 1,
    careerId: c.id,
    savedAt,
    cloudUid: null,
    player: {
      name: c.profile.name,
      nationality: c.profile.nationality,
      position: c.position,
      startPosition: c.profile.position,
      foot: c.profile.foot,
      preferredNumber: c.profile.number,
      startAge: c.profile.startAge,
      retirementAge,
      careerYears: seasons.length,
      firstSeason: first?.season ?? '',
      lastSeason: last?.season ?? '',
      retiredAt: c.retiredAt ?? c.updatedAt,
      retirementReason: c.forcedRetirementReason,
      mode: c.mode,
    },
    evolution: {
      peakOvr: c.peakOvr,
      peakOvrSeason: peakSeason?.season ?? null,
      finalOvr: computeOverall(c.attributes, c.position),
      potentialOvr: computeOverall(c.potential, c.position),
      finalAttributes: Object.fromEntries(keys.map((k) => [k, c.attributes[k] ?? 0])),
      topAttributes: attrsByImportance(c.position)
        .map((k) => ({ key: k, value: c.attributes[k] ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
      peakValue: c.peakValue,
      style: deriveStyle(c.potential, c.position),
    },
    totals: {
      seasons: seasons.length,
      apps: sum((s) => s.apps),
      starts: sum((s) => s.starts),
      minutes: sum((s) => s.minutes),
      goals: sum((s) => s.goals),
      assists: sum((s) => s.assists),
      cleanSheets: sum((s) => s.cleanSheets),
      avgRating: weightedRating(seasons),
      yellow: sum((s) => s.yellow),
      red: sum((s) => s.red),
      injuries: sum((s) => s.injuries.length),
      gamesInjured: sum((s) => s.injuries.reduce((t, i) => t + i.games, 0)),
      detail,
    },
    clubs: clubSpells(c),
    seasons: seasonRows(c),
    trophies: c.trophies.map((t) => ({ kind: t.kind, name: t.name, team: t.team, season: t.season, year: endYear(t.season) })),
    awards: [...c.awards],
    national: {
      country: getCountry(c.profile.nationality).name,
      callups: n.callups,
      caps: n.caps,
      starts: n.starts,
      goals: n.goals,
      assists: n.assists,
      debutSeason: n.debutSeason ?? null,
      tournaments: c.national.tournaments.map((t) => ({ season: t.season, year: endYear(t.season), name: t.name, result: t.result })),
    },
    transfers: c.transfers.map((t) => ({
      season: t.season,
      fromClub: getClub(t.fromClubId)?.name ?? t.fromClubId,
      toClub: getClub(t.toClubId)?.name ?? t.toClubId,
      fee: t.fee,
      kind: t.kind,
    })),
    earnings: { total: c.totalEarnings, peakWeeklyWage: seasons.reduce((m, s) => Math.max(m, s.weeklyWage), 0) },
    shirtNumbers: shirtHistory(c),
    legacy: c.legacy ?? computeLegacy(legacyInputFromCareer(c)),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Valida um resumo vindo do storage ou da nuvem. */
export function sanitizeSummary(raw: unknown): CareerSummary | null {
  if (!isObject(raw)) return null;
  const s = raw as Partial<CareerSummary>;
  if (s.summaryVersion !== 1 || typeof s.careerId !== 'string' || !isObject(s.player) || !isObject(s.totals)) return null;
  if (!Array.isArray(s.seasons) || !Array.isArray(s.clubs) || !Array.isArray(s.trophies) || !isObject(s.legacy)) return null;
  if (typeof s.player.name !== 'string') return null;
  return {
    ...(s as CareerSummary),
    savedAt: typeof s.savedAt === 'number' ? s.savedAt : 0,
    cloudUid: s.cloudUid ?? null,
    awards: Array.isArray(s.awards) ? s.awards : [],
    transfers: Array.isArray(s.transfers) ? s.transfers : [],
    shirtNumbers: Array.isArray(s.shirtNumbers) ? s.shirtNumbers : [],
  };
}

import { MATCH, NATIONAL } from '../config/balance';
import {
  CLUB_WORLD_CUP,
  CONTINENTAL_CUP,
  DOMESTIC_CUP_NAME,
  clubsInLeague,
  getClub,
  getLeague,
} from '../data/clubs';
import type { Career, Club, CompetitionResult, League, QualifierProgress, SeasonRecord, Trophy, TrophyKind } from '../types';
import { computeAwards } from './awards';
import { addStatLines, detailOf, emptyStatLine, outcomeProbs, playMatch, teamImpact, type PlayerMatchProfile, type PlayerSeasonState, type StatLine } from './match';
import { expectedStartShare } from './market';
import { NationalSeasonSim } from './national';
import { computeOverall } from './overall';
import { clamp, type Rng } from './rng';

export function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

export function leagueSize(league: League): number {
  return Math.floor(league.games / 2) + 1;
}

export interface TableTeam {
  name: string;
  strength: number;
  isPlayer: boolean;
}

/** Times da liga: os clubes nomeados + clubes genéricos que completam a tabela. */
export function leagueTeams(league: League): TableTeam[] {
  const named = clubsInLeague(league.id).map((c) => ({ name: c.name, strength: c.strength, isPlayer: false }));
  const size = leagueSize(league);
  const fillers = Math.max(0, size - named.length);
  const others: TableTeam[] = [];
  for (let i = 0; i < fillers; i++) {
    const strength = league.strength - 3 - (i * 13) / Math.max(1, fillers - 1);
    others.push({ name: `Clube ${i + 1}`, strength: Math.round(strength), isPlayer: false });
  }
  return [...named, ...others];
}

/** Pontos esperados de um time contra o resto da liga ao longo da temporada. */
export function expectedPoints(teamStrength: number, opponents: number[], games: number): number {
  if (opponents.length === 0) return 0;
  const perMatch =
    opponents.reduce((s, o) => {
      const p = outcomeProbs(teamStrength, o);
      return s + 3 * p.win + p.draw;
    }, 0) / opponents.length;
  return perMatch * games;
}

/** Clube consegue vaga continental na primeira temporada (pela força relativa na liga). */
export function initialContinentalQualification(club: Club): boolean {
  const league = getLeague(club.leagueId);
  const rank = clubsInLeague(league.id).filter((c) => c.strength > club.strength).length + 1;
  return rank <= league.continentalSpots;
}

const CUP_STAGES = ['1ª fase', '2ª fase', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
const CONT_KO = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

export interface SeasonSimOutput {
  record: SeasonRecord;
  continentalQualified: boolean;
  leaguePos: number;
  matchRatingAvg: number;
  /** Progresso das eliminatórias da seleção para a próxima temporada. */
  nationalQualifiers: QualifierProgress[];
}

export function simulateSeason(career: Career, rng: Rng): SeasonSimOutput {
  const club = getClub(career.clubId);
  if (!club) throw new Error('Carreira sem clube');
  const league = getLeague(club.leagueId);
  const ovr = computeOverall(career.attributes, career.position);
  const m = career.modifiers;
  const season = seasonLabel(career.year);

  const player: PlayerMatchProfile = {
    ovr,
    position: career.position,
    attributes: career.attributes,
    age: career.age,
    startShare: clamp(expectedStartShare(ovr, club.strength, career.coachTrust, career.position) + m.startShare, 0.02, 0.97),
    form: clamp(rng.normal(0, 0.2) + (career.morale - 50) / 250 + m.form, -0.6, 0.6),
    injuryRisk: m.injuryRisk,
    goalBonus: m.goalBonus,
  };
  const state: PlayerSeasonState = { injuredFor: m.preseasonInjuryGames, injuries: [] };
  if (m.preseasonInjuryGames > 0) state.injuries.push({ label: 'Lesão na pré-temporada', games: m.preseasonInjuryGames });

  const trophies: Trophy[] = [];
  const competitions: CompetitionResult[] = [];
  const addTrophy = (kind: TrophyKind, name: string, team = club.name) => trophies.push({ kind, name, season, team });

  // Seleção: as datas FIFA acontecem no meio da temporada de clubes.
  const nationalSim = new NationalSeasonSim(rng, player, state, {
    nationCode: career.profile.nationality,
    reputation: career.reputation,
    endYear: career.year + 1,
    season,
    callupBonus: m.callup,
    qualifiers: career.national.qualifiers ?? [],
  });
  const windowRounds = NATIONAL.windowsAt.map((f) => Math.floor(f * league.games));

  // ---------- Liga ----------
  const teams = leagueTeams(league);
  const others = teams.filter((t) => t.name !== club.name);
  const leagueLine = emptyStatLine();
  let points = 0;
  for (let g = 0; g < league.games; g++) {
    windowRounds.forEach((round) => {
      if (round === g) nationalSim.runWindow(leagueLine, g);
    });
    const opp = others[g % others.length];
    const r = playMatch(rng, player, state, leagueLine, club.strength, opp.strength + rng.normal(0, 2), false);
    points += r.outcome === 'W' ? 3 : r.outcome === 'D' ? 1 : 0;
  }
  const otherPoints = others.map((t) => {
    const opps = teams.filter((o) => o !== t).map((o) => (o.name === club.name ? club.strength + teamImpact(ovr, club.strength) * 0.5 : o.strength));
    return expectedPoints(t.strength, opps, league.games) + rng.normal(0, 5.5);
  });
  const leaguePos = 1 + otherPoints.filter((p) => p > points).length;
  const size = teams.length;
  if (leaguePos === 1) addTrophy('league', league.name);
  competitions.push({
    name: league.name,
    result: leaguePos === 1 ? 'Campeão' : `${leaguePos}º lugar · ${points} pts`,
    won: leaguePos === 1,
  });

  // ---------- Copa nacional ----------
  const cupLine = emptyStatLine();
  const cupName = DOMESTIC_CUP_NAME[league.id] ?? 'Copa Nacional';
  let cupResult = CUP_STAGES[0];
  let cupWon = false;
  for (let i = 0; i < MATCH.cupRounds; i++) {
    const opp = league.strength - 12 + i * 3 + rng.range(-5, 5);
    const r = playMatch(rng, player, state, cupLine, club.strength, opp, true);
    cupResult = CUP_STAGES[i];
    if (!r.advanced) break;
    if (i === MATCH.cupRounds - 1) cupWon = true;
  }
  if (cupWon) addTrophy('cup', cupName);
  competitions.push({ name: cupName, result: cupWon ? 'Campeão' : cupResult === 'Final' ? 'Vice-campeão' : cupResult, won: cupWon });

  // ---------- Continental ----------
  const contLine = emptyStatLine();
  const cont = CONTINENTAL_CUP[league.continent];
  let contWon = false;
  if (career.continentalQualified) {
    let groupPts = 0;
    for (let g = 0; g < MATCH.continentalGroupGames; g++) {
      const opp = rng.range(cont.pool[0] - 4, cont.pool[1] - 2);
      const r = playMatch(rng, player, state, contLine, club.strength, opp, false);
      groupPts += r.outcome === 'W' ? 3 : r.outcome === 'D' ? 1 : 0;
    }
    let result = 'Fase de grupos';
    if (groupPts >= 10 || (groupPts >= 8 && rng.chance(0.5))) {
      for (let i = 0; i < CONT_KO.length; i++) {
        const opp = cont.pool[0] + (i + 1) * ((cont.pool[1] - cont.pool[0]) / 5) + rng.range(-3, 3);
        const r = playMatch(rng, player, state, contLine, club.strength, opp, true);
        result = CONT_KO[i];
        if (!r.advanced) break;
        if (i === CONT_KO.length - 1) contWon = true;
      }
    }
    if (contWon) addTrophy('continental', cont.name);
    competitions.push({ name: cont.name, result: contWon ? 'Campeão' : result === 'Final' ? 'Vice-campeão' : result, won: contWon });
  }

  // ---------- Mundial de clubes ----------
  if (contWon) {
    const semi = playMatch(rng, player, state, contLine, club.strength, rng.range(64, 76), true);
    let won = false;
    let result = 'Semifinal';
    if (semi.advanced) {
      const finalOpp = league.continent === 'EUR' ? rng.range(74, 81) : rng.range(84, 91);
      const fin = playMatch(rng, player, state, contLine, club.strength, finalOpp, true);
      won = fin.advanced;
      result = won ? 'Campeão' : 'Vice-campeão';
    }
    if (won) addTrophy('clubWorld', CLUB_WORLD_CUP);
    competitions.push({ name: CLUB_WORLD_CUP, result, won });
  }

  // ---------- Consolidação do clube ----------
  const total: StatLine = addStatLines(addStatLines(leagueLine, cupLine), contLine);
  const rating = total.apps > 0 ? Math.round((total.ratingSum / total.apps) * 100) / 100 : 0;
  const clubGames = league.games + MATCH.cupRounds;

  // ---------- Seleção (finais e torneios no meio do ano) ----------
  const national = nationalSim.finish(total, clubGames);
  for (const t of national.trophies) addTrophy(t.kind, t.name, 'Seleção');
  const nat = national.season;
  const internationalBonus =
    nat.caps > 0 ? Math.min(12, (nat.goals ?? 0) * 0.8 + (nat.assists ?? 0) * 0.5 + ((nat.rating ?? 0) > 0 ? ((nat.rating ?? 0) - 6.8) * 6 : 0)) : 0;

  const awards = computeAwards(
    {
      season,
      age: career.age,
      ovr,
      position: career.position,
      league,
      leaguePos,
      apps: total.apps,
      starts: total.starts,
      minutes: total.minutes,
      goals: total.goals,
      leagueGoals: leagueLine.goals,
      assists: total.assists,
      cleanSheets: total.cleanSheets,
      rating,
      trophyKinds: trophies.map((t) => t.kind),
      continentalPrestige: cont.prestige,
      internationalBonus,
    },
    rng,
  );
  awards.push(...national.awards);

  const record: SeasonRecord = {
    season,
    year: career.year,
    age: career.age,
    clubId: club.id,
    clubName: club.name,
    leagueId: league.id,
    loan: career.parentClubId !== null,
    position: career.position,
    apps: total.apps,
    starts: total.starts,
    minutes: total.minutes,
    goals: total.goals,
    leagueGoals: leagueLine.goals,
    assists: total.assists,
    cleanSheets: total.cleanSheets,
    rating,
    yellow: total.yellow,
    red: total.red,
    detail: detailOf(total),
    injuries: state.injuries,
    leaguePos,
    leagueSize: size,
    competitions,
    trophies,
    awards,
    ovrStart: ovr,
    ovrEnd: ovr,
    attrDelta: {},
    marketValue: 0,
    weeklyWage: career.weeklyWage,
    national: national.season,
    headlines: [],
    events: career.events.map((e) => e.defId),
    eventNotes: career.events.flatMap((e) => (e.resolved ? [e.resolved.text] : [])),
  };

  return {
    record,
    continentalQualified: leaguePos <= league.continentalSpots,
    leaguePos,
    matchRatingAvg: rating,
    nationalQualifiers: national.qualifiers,
  };
}

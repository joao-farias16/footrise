import { NATIONAL, STATS } from '../config/balance';
import { CONTINENTAL_NATION_CUP, COUNTRIES, getCountry } from '../data/countries';
import type { Award, Confederation, CompetitionResult, Country, NationalCompetition, NationalSeason, QualifierProgress, TrophyKind } from '../types';
import { emptyStatLine, playMatch, simulateTeamMatch, type MatchResult, type PlayerMatchProfile, type PlayerSeasonState, type StatLine } from './match';
import { clamp, sigmoid, type Rng } from './rng';

// Calendário internacional do FootRise.
//
// Ciclo de 4 anos (ano = ano em que a temporada termina):
//   ano % 4 = 1 → Eliminatórias da Copa (1ª metade) · Liga das Nações (UEFA / CONCACAF)
//   ano % 4 = 2 → Eliminatórias da Copa (2ª metade) → COPA DO MUNDO
//   ano % 4 = 3 → Liga das Nações (UEFA) · eliminatórias continentais · Copa Ouro / Copa Africana / Copa da Ásia
//   ano % 4 = 0 → Eliminatórias da Eurocopa (2ª metade) → EUROCOPA / COPA AMÉRICA
// Datas FIFA acontecem durante a temporada de clubes; torneios e finais, no meio do ano.

export const WORLD_CUP = 'Copa do Mundo';

export function callupProbability(ovr: number, nationCode: string, reputation: number, bonus = 0): number {
  const nation = getCountry(nationCode);
  const bar = nation.strength - NATIONAL.callupGap;
  return clamp(sigmoid((ovr - bar) / NATIONAL.callupScale + (reputation - 50) / 80 + bonus), 0, 0.99);
}

export type TournamentKind = 'worldCup' | 'continentalNation';

/** Ano (mod 4) do torneio continental de cada confederação. */
const CONTINENTAL_YEAR_MOD: Record<Confederation, number> = {
  UEFA: NATIONAL.continentalYearMod,
  CONMEBOL: NATIONAL.continentalYearMod,
  CONCACAF: 3,
  CAF: 3,
  AFC: 3,
};

/** Torneio de seleções disputado ao fim da temporada que termina em `endYear`. */
export function tournamentFor(endYear: number, nationCode: string): { kind: TournamentKind; name: string } | null {
  if (endYear % 4 === NATIONAL.worldCupYearMod) return { kind: 'worldCup', name: WORLD_CUP };
  const confed = getCountry(nationCode).confed;
  if (endYear % 4 === CONTINENTAL_YEAR_MOD[confed]) return { kind: 'continentalNation', name: CONTINENTAL_NATION_CUP[confed] };
  return null;
}

// ---------- Estrutura de competições ----------

type CompKind = NationalCompetition['kind'];

interface Campaign {
  /** Chave usada para acumular pontos entre temporadas (eliminatórias). */
  id?: string;
  kind: CompKind;
  name: string;
  games: number;
  /** Fecha a campanha nesta temporada (decide classificação). */
  closes?: boolean;
  /** Classificação para o torneio de: worldCup | continental. */
  qualifiesFor?: 'worldCup' | 'continental';
}

/** Seleções fictícias que completam os grupos (força), por confederação. */
const FILLERS: Record<Confederation, number[]> = {
  UEFA: [70, 68, 66, 64, 62, 60, 58, 56, 54, 50, 46],
  CONMEBOL: [70, 68, 64],
  CONCACAF: [66, 62, 60, 58, 55, 52, 50, 46],
  CAF: [72, 70, 68, 66, 64, 62, 60, 58, 55, 52],
  AFC: [70, 68, 66, 64, 62, 60, 57, 54, 50],
};

function confedPool(nation: Country): number[] {
  const real = COUNTRIES.filter((c) => c.confed === nation.confed && c.code !== nation.code && c.code !== 'URS').map((c) => c.strength);
  return [...real, ...FILLERS[nation.confed]];
}

const WC_QUAL_GAMES: Record<Confederation, number> = { UEFA: 4, CONMEBOL: 8, CONCACAF: 4, CAF: 4, AFC: 4 };

/** ppg mínimo para vaga direta e para repescagem, por confederação. */
const WC_QUAL_PPG: Record<Confederation, [number, number]> = {
  UEFA: [2.0, 1.5],
  CONMEBOL: [1.45, 1.2],
  CONCACAF: [1.8, 1.4],
  CAF: [2.1, 1.7],
  AFC: [2.0, 1.6],
};
const CONT_QUAL_PPG: Record<Confederation, [number, number]> = {
  UEFA: [1.6, 1.2],
  CONMEBOL: [0, 0],
  CONCACAF: [1.5, 1.1],
  CAF: [1.5, 1.1],
  AFC: [1.4, 1.0],
};

const CONT_QUAL_NAME: Record<Confederation, string> = {
  UEFA: 'Eliminatórias da Eurocopa',
  CONMEBOL: '',
  CONCACAF: 'Eliminatórias da Copa Ouro',
  CAF: 'Eliminatórias da Copa Africana',
  AFC: 'Eliminatórias da Copa da Ásia',
};

export const NATIONS_LEAGUE_NAME: Partial<Record<Confederation, string>> = {
  UEFA: 'Liga das Nações da UEFA',
  CONCACAF: 'Liga das Nações da CONCACAF',
};

/** Campanhas da seleção durante as datas FIFA de uma temporada. */
export function seasonCampaigns(endYear: number, nation: Country): Campaign[] {
  const mod = endYear % 4;
  const confed = nation.confed;
  const wcYear = endYear + ((NATIONAL.worldCupYearMod - mod + 4) % 4);
  const contMod = CONTINENTAL_YEAR_MOD[confed];
  const contYear = endYear + ((contMod - mod + 4) % 4);
  const out: Campaign[] = [];

  // Eliminatórias da Copa: duas temporadas antes do Mundial.
  if (mod === 1 || mod === 2) {
    out.push({
      id: `wc-${wcYear}`,
      kind: 'qualifier',
      name: 'Eliminatórias da Copa do Mundo',
      games: WC_QUAL_GAMES[confed],
      closes: mod === 2,
      qualifiesFor: 'worldCup',
    });
  }

  // Liga das Nações.
  const nl = NATIONS_LEAGUE_NAME[confed];
  if (nl && ((confed === 'UEFA' && mod % 2 === 1) || (confed === 'CONCACAF' && mod === 1))) {
    out.push({ kind: 'nationsLeague', name: nl, games: confed === 'UEFA' ? 6 : 4 });
  }

  // Eliminatórias continentais: duas temporadas antes do torneio (a Copa América não tem).
  const contQualMods = [(contMod + 3) % 4, contMod];
  if (confed !== 'CONMEBOL' && contQualMods.includes(mod) && !(confed === 'CONCACAF' && nation.strength >= 66)) {
    out.push({
      id: `cont-${contYear}`,
      kind: 'qualifier',
      name: CONT_QUAL_NAME[confed],
      games: 4,
      closes: mod === contMod,
      qualifiesFor: 'continental',
    });
  }
  return out;
}

/** Competições da seleção na temporada, na ordem do calendário (para exibição). */
export function nationalCalendar(endYear: number, nationCode: string): string[] {
  const nation = getCountry(nationCode);
  const names = seasonCampaigns(endYear, nation).map((c) => c.name);
  const total = NATIONAL.windowsAt.length * NATIONAL.gamesPerWindow;
  const official = seasonCampaigns(endYear, nation).reduce((s, c) => s + c.games, 0);
  if (official < total) names.push('Amistosos');
  const t = tournamentFor(endYear, nationCode);
  if (t) names.push(`${t.name} ${endYear}`);
  return names;
}

// ---------- Simulação ----------

export interface NationalSimResult {
  season: NationalSeason;
  trophies: { kind: TrophyKind; name: string }[];
  awards: Award[];
  /** Progresso atualizado das eliminatórias (atravessa temporadas). */
  qualifiers: QualifierProgress[];
  ratingSum: number;
  /** Mantido para compatibilidade: primeiro troféu da temporada. */
  trophy?: { kind: TrophyKind; name: string };
}

export interface NationalContext {
  nationCode: string;
  reputation: number;
  /** Ano em que a temporada termina (define o calendário). */
  endYear: number;
  season: string;
  callupBonus: number;
  qualifiers: QualifierProgress[];
}

interface MatchSlot {
  campaign: Campaign;
  opp: number;
}

interface CompTracker {
  campaign: Campaign;
  points: number;
  games: number;
  caps: number;
  goals: number;
  assists: number;
  inSquad: boolean;
}

const KO_WC = ['16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
const KO_8 = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
const KO_4 = ['Quartas de final', 'Semifinal', 'Final'];

/** Formato de cada torneio: fases eliminatórias e força típica dos adversários por fase. */
function tournamentFormat(kind: TournamentKind, confed: Confederation): { stages: string[]; group: number; ko: number[] } {
  if (kind === 'worldCup') return { stages: KO_WC, group: 74, ko: [76, 79, 82, 84, 86] };
  switch (confed) {
    case 'UEFA':
      return { stages: KO_8, group: 74, ko: [77, 80, 83, 85] };
    case 'CONMEBOL':
      return { stages: KO_4, group: 72, ko: [77, 81, 85] };
    case 'CONCACAF':
      return { stages: KO_4, group: 60, ko: [64, 69, 73] };
    case 'CAF':
      return { stages: KO_8, group: 66, ko: [69, 72, 75, 77] };
    case 'AFC':
      return { stages: KO_8, group: 62, ko: [66, 70, 73, 75] };
  }
}

/** Seleção do jogador ao longo de uma temporada: convocações, jogos e campanhas. */
export class NationalSeasonSim {
  private readonly nation: Country;
  private readonly line: StatLine = emptyStatLine();
  private readonly trackers: CompTracker[];
  private readonly windows: MatchSlot[][];
  private readonly qualifiers: Map<string, QualifierProgress>;
  private windowIndex = 0;
  private callups = 0;
  private windowsPlayed = 0;
  private missedInjured = 0;
  private lastCalled = false;
  private readonly natPlayer: PlayerMatchProfile;
  private readonly trophies: { kind: TrophyKind; name: string }[] = [];
  private readonly awards: Award[] = [];
  private readonly competitions: NationalCompetition[] = [];
  private tournament?: CompetitionResult;

  constructor(
    private readonly rng: Rng,
    private readonly player: PlayerMatchProfile,
    private readonly state: PlayerSeasonState,
    private readonly ctx: NationalContext,
  ) {
    this.nation = getCountry(ctx.nationCode);
    this.qualifiers = new Map(ctx.qualifiers.map((q) => [q.id, { ...q }]));
    this.natPlayer = {
      ...player,
      startShare: clamp(sigmoid((player.ovr - this.nation.strength + 3) / 3), 0.08, 0.95),
      shareScale: STATS.nationalShare,
    };
    const campaigns = seasonCampaigns(ctx.endYear, this.nation);
    this.trackers = campaigns.map((campaign) => ({ campaign, points: 0, games: 0, caps: 0, goals: 0, assists: 0, inSquad: false }));
    this.windows = this.planWindows(campaigns);
  }

  /** Distribui os jogos das campanhas pelas datas FIFA e completa com amistosos. */
  private planWindows(campaigns: Campaign[]): MatchSlot[][] {
    const pool = confedPool(this.nation);
    const slots: MatchSlot[] = [];
    for (const c of campaigns) {
      for (let g = 0; g < c.games; g++) {
        let opp: number;
        if (c.kind === 'nationsLeague') {
          // Grupos da Liga das Nações reúnem seleções de nível parecido.
          opp = this.nation.strength + this.rng.range(-5, 4);
        } else {
          opp = this.rng.pick(pool) + this.rng.range(-2, 2);
        }
        slots.push({ campaign: c, opp });
      }
    }
    const total = NATIONAL.windowsAt.length * NATIONAL.gamesPerWindow;
    const friendly: Campaign = { kind: 'friendly', name: 'Amistosos', games: 0 };
    while (slots.length < total) {
      slots.push({ campaign: friendly, opp: clamp(this.nation.strength + this.rng.range(-10, 6), 45, 90) });
      friendly.games++;
    }
    if (friendly.games > 0) this.trackers.push({ campaign: friendly, points: 0, games: 0, caps: 0, goals: 0, assists: 0, inSquad: false });
    const ordered = slots.slice(0, total);
    const windows: MatchSlot[][] = [];
    for (let w = 0; w < NATIONAL.windowsAt.length; w++) windows.push(ordered.slice(w * NATIONAL.gamesPerWindow, (w + 1) * NATIONAL.gamesPerWindow));
    return windows;
  }

  get windowCount(): number {
    return this.windows.length;
  }

  /** Decide a convocação com base em nível, reputação, forma no clube e continuidade. */
  private decideCallup(clubLine: StatLine | null, clubGamesSoFar: number, extraBonus = 0): boolean {
    if (this.player.age < 17) return false;
    if (this.state.injuredFor > 0) {
      // Só conta como "perdeu a convocação" quando ela era realmente provável.
      if (callupProbability(this.player.ovr, this.ctx.nationCode, this.ctx.reputation, this.ctx.callupBonus) >= 0.3) this.missedInjured++;
      return false;
    }
    let bonus = this.ctx.callupBonus + extraBonus + (this.lastCalled ? NATIONAL.continuityBonus : 0);
    if (clubLine && clubLine.apps >= 3) {
      const avg = clubLine.ratingSum / clubLine.apps;
      bonus += (avg - 6.8) * NATIONAL.clubFormWeight;
      const minutesShare = clubLine.minutes / Math.max(1, clubGamesSoFar * 90);
      if (minutesShare < 0.35) bonus -= NATIONAL.benchPenalty;
    }
    return this.rng.chance(callupProbability(this.player.ovr, this.ctx.nationCode, this.ctx.reputation, bonus));
  }

  private tracker(c: Campaign): CompTracker {
    return this.trackers.find((t) => t.campaign === c)!;
  }

  private play(called: boolean, opp: number, knockout: boolean, t?: CompTracker): MatchResult {
    const r = called
      ? playMatch(this.rng, this.natPlayer, this.state, this.line, this.nation.strength, opp, knockout)
      : simulateTeamMatch(this.rng, this.nation.strength, opp, knockout);
    if (t) {
      t.games++;
      t.points += r.outcome === 'W' ? 3 : r.outcome === 'D' ? 1 : 0;
      if (r.minutes > 0) {
        t.caps++;
        t.goals += r.goals;
        t.assists += r.assists;
      }
      if (called) t.inSquad = true;
    }
    return r;
  }

  /** Data FIFA durante a temporada de clubes. */
  runWindow(clubLine: StatLine | null, clubGamesSoFar: number): void {
    const slots = this.windows[this.windowIndex++];
    if (!slots) return;
    this.windowsPlayed++;
    const called = this.decideCallup(clubLine, clubGamesSoFar);
    if (called) this.callups++;
    this.lastCalled = called;
    for (const s of slots) this.play(called, s.opp, false, this.tracker(s.campaign));
  }

  /** Fim da temporada: fecha campanhas, disputa finais e torneios. */
  finish(clubLine: StatLine | null, clubGames: number): NationalSimResult {
    while (this.windowIndex < this.windows.length) this.runWindow(clubLine, clubGames);

    let qualifiedWc = false;
    let qualifiedCont = false;
    for (const t of this.trackers) {
      const c = t.campaign;
      if (c.kind === 'friendly') {
        this.pushComp(t, `${t.games} jogos`, false);
      } else if (c.kind === 'qualifier' && c.id) {
        const q = this.qualifiers.get(c.id) ?? { id: c.id, points: 0, games: 0 };
        q.points += t.points;
        q.games += t.games;
        this.qualifiers.set(c.id, q);
        if (c.closes) {
          const ok = this.resolveQualification(q, c.qualifiesFor === 'worldCup' ? WC_QUAL_PPG : CONT_QUAL_PPG);
          if (c.qualifiesFor === 'worldCup') qualifiedWc = ok;
          else qualifiedCont = ok;
          this.pushComp(t, ok ? `Classificado · ${q.points} pts` : `Eliminado · ${q.points} pts`, false);
          this.qualifiers.delete(c.id);
        } else {
          this.pushComp(t, `Em andamento · ${q.points} pts em ${q.games} jogos`, false);
        }
      } else if (c.kind === 'nationsLeague') {
        this.resolveNationsLeague(t, clubLine, clubGames);
      }
    }

    // Torneio do meio do ano.
    const tournament = tournamentFor(this.ctx.endYear, this.ctx.nationCode);
    if (tournament) {
      const confed = this.nation.confed;
      const autoQualified =
        tournament.kind === 'continentalNation' &&
        (confed === 'CONMEBOL' || (confed === 'CONCACAF' && this.nation.strength >= 66) || !this.hadQualifier('continental'));
      const qualified = tournament.kind === 'worldCup' ? qualifiedWc || !this.hadQualifier('worldCup') : qualifiedCont || autoQualified;
      if (qualified) this.playTournament(tournament, clubLine, clubGames);
    }

    const season: NationalSeason = {
      calledUp: this.callups > 0,
      caps: this.line.apps,
      goals: this.line.goals,
      tournament: this.tournament,
      callups: this.callups,
      windows: this.windowsPlayed,
      starts: this.line.starts,
      assists: this.line.assists,
      minutes: this.line.minutes,
      rating: this.line.apps > 0 ? Math.round((this.line.ratingSum / this.line.apps) * 100) / 100 : 0,
      missedInjured: this.missedInjured,
      competitions: this.competitions,
    };
    return {
      season,
      trophies: this.trophies,
      awards: this.awards,
      qualifiers: [...this.qualifiers.values()],
      ratingSum: this.line.ratingSum,
      trophy: this.trophies[0],
    };
  }

  /** Houve eliminatória para esse torneio no ciclo (temporada atual ou já registrada). */
  private hadQualifier(target: 'worldCup' | 'continental'): boolean {
    return this.trackers.some((t) => t.campaign.qualifiesFor === target);
  }

  private resolveQualification(q: QualifierProgress, table: Record<Confederation, [number, number]>): boolean {
    const [direct, playoff] = table[this.nation.confed];
    const ppg = q.games > 0 ? q.points / q.games : 0;
    if (ppg >= direct) return true;
    if (ppg >= playoff) return this.rng.chance(0.55);
    return false;
  }

  private pushComp(t: CompTracker, result: string, won: boolean): void {
    this.competitions.push({
      name: t.campaign.name,
      kind: t.campaign.kind,
      result,
      won,
      inSquad: t.inSquad,
      caps: t.caps,
      goals: t.goals,
      assists: t.assists,
    });
  }

  private resolveNationsLeague(t: CompTracker, clubLine: StatLine | null, clubGames: number): void {
    const confed = this.nation.confed;
    const topTier = confed === 'UEFA' ? this.nation.strength >= 80 : this.nation.strength >= 72;
    const tierLabel = confed === 'UEFA' ? (this.nation.strength >= 80 ? 'Liga A' : this.nation.strength >= 72 ? 'Liga B' : 'Liga C') : topTier ? 'Liga A' : 'Liga B';
    const ppg = t.games > 0 ? t.points / t.games : 0;
    const groupWinner = ppg >= 2.15 || (ppg >= 1.8 && this.rng.chance(0.5));
    if (!groupWinner) {
      this.pushComp(t, `${tierLabel} · ${t.points} pts`, false);
      return;
    }
    if (!topTier) {
      this.pushComp(t, `${tierLabel} · 1º do grupo (acesso)`, false);
      return;
    }
    // Finais (meio do ano): semifinal e final.
    const called = this.decideCallup(clubLine, clubGames, NATIONAL.continuityBonus * 0.5);
    if (called) this.callups++;
    const base = confed === 'UEFA' ? 84 : 72;
    let result = 'Semifinal';
    let won = false;
    for (let i = 0; i < 2; i++) {
      const r = this.play(called, base + i * 2 + this.rng.range(-3, 3), true, t);
      if (!r.advanced) {
        result = i === 0 ? 'Semifinal' : 'Vice-campeão';
        break;
      }
      if (i === 1) {
        won = true;
        result = 'Campeão';
      }
    }
    if (won && called) this.trophies.push({ kind: 'nationsLeague', name: t.campaign.name });
    this.pushComp(t, `Finais · ${result}`, won);
  }

  private playTournament(tournament: { kind: TournamentKind; name: string }, clubLine: StatLine | null, clubGames: number): void {
    const confed = this.nation.confed;
    const fmt = tournamentFormat(tournament.kind, confed);
    const called = this.decideCallup(clubLine, clubGames, NATIONAL.tournamentSquadBonus + (this.lastCalled ? 0.3 : 0));
    if (called) this.callups++;
    const kind: CompKind = tournament.kind === 'worldCup' ? 'worldCup' : 'continental';
    const t: CompTracker = { campaign: { kind, name: tournament.name, games: 0 }, points: 0, games: 0, caps: 0, goals: 0, assists: 0, inSquad: false };
    const before = { goals: this.line.goals, apps: this.line.apps, ratingSum: this.line.ratingSum };

    for (let g = 0; g < 3; g++) this.play(called, fmt.group + this.rng.range(-8, 8), false, t);
    let result = 'Fase de grupos';
    let won = false;
    const advance = t.points >= 4 || (t.points === 3 && this.rng.chance(tournament.kind === 'worldCup' ? 0.6 : 0.5));
    if (advance) {
      for (let i = 0; i < fmt.stages.length; i++) {
        const r = this.play(called, fmt.ko[i] + this.rng.range(-4, 4), true, t);
        result = fmt.stages[i];
        if (!r.advanced) break;
        if (i === fmt.stages.length - 1) {
          won = true;
          result = 'Campeão';
        }
      }
    }
    const finalResult = won ? 'Campeão' : result === 'Final' ? 'Vice-campeão' : result;
    this.tournament = { name: tournament.name, result: finalResult, won };
    this.pushComp(t, finalResult, won);
    if (won && called) this.trophies.push({ kind: tournament.kind, name: tournament.name });

    // Prêmios do torneio.
    if (called) {
      const goals = this.line.goals - before.goals;
      const apps = this.line.apps - before.apps;
      const rating = apps > 0 ? (this.line.ratingSum - before.ratingSum) / apps : 0;
      const rivalGoals = Math.round((tournament.kind === 'worldCup' ? 6 : 4.5) + this.rng.normal(0, 1.2));
      if (goals >= Math.max(3, rivalGoals)) {
        this.awards.push({ kind: 'tournamentTopScorer', name: `Artilheiro da ${tournament.name}`, season: this.ctx.season });
      }
      const deepRun = won || result === 'Final' || result === 'Semifinal';
      if (apps >= 4 && deepRun && rating + (won ? 0.25 : 0) >= 7.35 + this.rng.normal(0, 0.15)) {
        this.awards.push({ kind: 'tournamentBest', name: `Melhor jogador da ${tournament.name}`, season: this.ctx.season });
      }
    }
  }
}

/** Atalho: simula a temporada inteira da seleção de uma vez (usado em testes e compatibilidade). */
export function simulateNationalSeason(
  rng: Rng,
  player: PlayerMatchProfile,
  state: PlayerSeasonState,
  nationCode: string,
  reputation: number,
  endYear: number,
  callupBonus: number,
  qualifiers: QualifierProgress[] = [],
  season = '',
): NationalSimResult {
  const sim = new NationalSeasonSim(rng, player, state, { nationCode, reputation, endYear, season, callupBonus, qualifiers });
  return sim.finish(null, 0);
}

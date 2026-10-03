import { INJURY_SEVERITY, MATCH, PLAYING_TIME, STATS } from '../config/balance';
import { POSITIONS, type StatProfile } from '../config/positions';
import type { AttrKey, Attributes, DetailStats, InjuryRecord, PositionId } from '../types';
import { clamp, type Rng } from './rng';

/** Estatísticas acumuladas do jogador em um conjunto de partidas. */
export interface StatLine extends DetailStats {
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  ratingSum: number;
  yellow: number;
  red: number;
}

export function emptyStatLine(): StatLine {
  return {
    apps: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    ratingSum: 0,
    yellow: 0,
    red: 0,
    shots: 0,
    keyPasses: 0,
    tackles: 0,
    interceptions: 0,
    clearances: 0,
    saves: 0,
    conceded: 0,
  };
}

export function addStatLines(a: StatLine, b: StatLine): StatLine {
  const out = emptyStatLine();
  for (const k of Object.keys(out) as (keyof StatLine)[]) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
}

export function detailOf(line: StatLine): DetailStats {
  const { shots, keyPasses, tackles, interceptions, clearances, saves, conceded } = line;
  return { shots, keyPasses, tackles, interceptions, clearances, saves, conceded };
}

export interface PlayerMatchProfile {
  ovr: number;
  position: PositionId;
  attributes: Attributes;
  age: number;
  /** Probabilidade de começar jogando. */
  startShare: number;
  form: number;
  injuryRisk: number;
  goalBonus: number;
  /** Escala da participação individual em gols (1 no clube; menor na seleção). */
  shareScale?: number;
}

export interface MatchResult {
  scored: number;
  conceded: number;
  /** 'W' | 'D' | 'L' no tempo normal. */
  outcome: 'W' | 'D' | 'L';
  /** Para mata-mata: venceu (incluindo pênaltis). */
  advanced: boolean;
  /** Minutos jogados pelo jogador (0 = não entrou). */
  minutes: number;
  /** Nota do jogador na partida (0 se não jogou). */
  rating: number;
  goals: number;
  assists: number;
}

/** Estado mutável do jogador ao longo de uma temporada (lesões, suspensões, fase). */
export interface PlayerSeasonState {
  injuredFor: number;
  injuries: InjuryRecord[];
  /** Jogos de suspensão a cumprir. */
  suspendedFor?: number;
  /** Fase recente (−cap..+cap): sequência de boas ou más atuações. */
  momentum?: number;
}

// ---------- Perfil ofensivo e defensivo ----------

function mix(attrs: Attributes, weights: Partial<Record<AttrKey, number>>, fallback = 50): number {
  let total = 0;
  let w = 0;
  for (const [k, v] of Object.entries(weights)) {
    total += (attrs[k as AttrKey] ?? fallback) * (v ?? 0);
    w += v ?? 0;
  }
  return w > 0 ? total / w : STATS.attrPivot;
}

const rel = (value: number, exp: number) => (Math.max(1, value) / STATS.attrPivot) ** exp;

export interface Involvement {
  /** Probabilidade de o jogador marcar um gol do time enquanto está em campo. */
  goal: number;
  /** Probabilidade de dar a assistência de um gol do time enquanto está em campo. */
  assist: number;
  /** Conversão das finalizações (0–1). */
  conversion: number;
  /** Médias por 90 minutos (antes da pressão do adversário). */
  keyPasses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  /** Aproveitamento de defesas (goleiros). */
  savePct: number;
}

/**
 * Traduz atributos + posição + nível relativo ao elenco em participação esperada.
 * Ex.: centroavante com finalização 98 num elenco abaixo dele concentra ~45% dos gols do time;
 * um centroavante mediano, ~20%; um zagueiro, ~3%.
 */
export function involvement(player: Pick<PlayerMatchProfile, 'ovr' | 'position' | 'attributes'>, teamStrength: number): Involvement {
  const pos = POSITIONS[player.position];
  const p: StatProfile = pos.stats;
  const a = player.attributes;
  const relative = clamp(Math.exp((player.ovr - teamStrength) / STATS.relScale), STATS.relMin, STATS.relMax);

  const finish = mix(a, p.finish);
  const access = mix(a, p.access);
  const create = mix(a, p.create);
  let goal = p.goal > 0 ? p.goal * rel(finish, STATS.finishExp) * rel(access, STATS.accessExp) * relative : 0;
  let assist = p.assist * rel(create, STATS.creativeExp) * relative;
  if (goal > STATS.goalShareKnee) goal = STATS.goalShareKnee * (goal / STATS.goalShareKnee) ** STATS.goalShareCompression;
  goal = Math.min(goal, STATS.maxGoalShare);
  assist = Math.min(assist, STATS.maxAssistShare);
  const total = goal + assist;
  if (total > STATS.maxInvolvement) {
    goal *= STATS.maxInvolvement / total;
    assist *= STATS.maxInvolvement / total;
  }

  const sho = a.sho ?? finish;
  const conversion = clamp(STATS.conversionBase + (sho - 50) * STATS.conversionPerPoint, 0.06, 0.26);
  const def = a.def ?? 50;
  const defF = rel(def, STATS.defensiveExp);
  const aerial = rel(def * 0.6 + (a.phy ?? 50) * 0.4, 1);

  const keeper = (a.ref ?? 50) * 0.3 + (a.div ?? 50) * 0.3 + (a.gkp ?? 50) * 0.25 + (a.han ?? 50) * 0.15;
  const savePct = clamp(STATS.keeperSaveBase + (keeper - STATS.attrPivot) * STATS.keeperSavePerPoint, 0.55, 0.85);

  return {
    goal,
    assist,
    conversion,
    keyPasses: p.keyPasses * rel(create, 1.5) * relative,
    tackles: pos.group === 'gk' ? 0 : p.tackles * defF,
    interceptions: pos.group === 'gk' ? p.interceptions : p.interceptions * defF,
    clearances: p.clearances * (pos.group === 'gk' ? 1 : aerial),
    savePct,
  };
}

export function expectedGoals(teamStr: number, oppStr: number): number {
  return MATCH.baseGoals * Math.exp((teamStr - oppStr) / MATCH.strengthScale);
}

function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/** Probabilidades de vitória/empate/derrota pelo modelo de Poisson. */
export function outcomeProbs(teamStr: number, oppStr: number): { win: number; draw: number; loss: number } {
  const ls = expectedGoals(teamStr, oppStr);
  const lc = expectedGoals(oppStr, teamStr);
  let win = 0;
  let draw = 0;
  for (let a = 0; a <= 10; a++) {
    const pa = poissonPmf(ls, a);
    for (let b = 0; b <= 10; b++) {
      const p = pa * poissonPmf(lc, b);
      if (a > b) win += p;
      else if (a === b) draw += p;
    }
  }
  return { win, draw, loss: Math.max(0, 1 - win - draw) };
}

/**
 * Quanto o jogador muda o nível do time (em pontos de força).
 * A diferença para o elenco conta, e craques (OVR alto) têm peso extra.
 */
export function teamImpact(ovr: number, teamStrength: number): number {
  const elite = Math.max(0, ovr - MATCH.eliteOvr) * MATCH.eliteImpact;
  return clamp((ovr - teamStrength) * MATCH.playerImpact + elite, -MATCH.playerImpactCap, MATCH.playerImpactCap);
}

/** Partida do time sem o jogador em campo (ex.: seleção quando ele não foi convocado). */
export function simulateTeamMatch(rng: Rng, teamStrength: number, oppStrength: number, knockout: boolean): MatchResult {
  const scored = rng.poisson(expectedGoals(teamStrength, oppStrength));
  const conceded = rng.poisson(expectedGoals(oppStrength, teamStrength));
  const outcome: MatchResult['outcome'] = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
  const advanced = outcome === 'W' || (knockout && outcome === 'D' && rng.chance(0.5));
  return { scored, conceded, outcome, advanced, minutes: 0, rating: 0, goals: 0, assists: 0 };
}

/** Minutos do jogador na partida: titular, reserva que entra ou fora. */
function decideMinutes(rng: Rng, player: PlayerMatchProfile, teamStrength: number): { minutes: number; started: boolean } {
  if (rng.chance(player.startShare)) {
    const p = POSITIONS[player.position].stats;
    const phy = player.attributes.phy ?? 60;
    const fullChance = clamp(
      p.fullMatch + (phy - 70) / 200 + (player.ovr - teamStrength) / 100 - (player.age >= 32 ? 0.08 : 0) - (player.age <= 19 ? 0.06 : 0),
      0.3,
      0.98,
    );
    return { started: true, minutes: rng.chance(fullChance) ? 90 : rng.int(58, 85) };
  }
  if (rng.chance(PLAYING_TIME.subChance)) {
    // Quem entra costuma ganhar o segundo tempo final: 10–35 minutos, mais comum 15–25.
    return { started: false, minutes: Math.round(clamp(rng.normal(21, 7), 6, 40)) };
  }
  return { started: false, minutes: 0 };
}

/**
 * Simula uma partida do time do jogador e acumula a participação dele em `line`.
 * Retorna o placar, se o time avançou (mata-mata) e o desempenho individual.
 */
export function playMatch(
  rng: Rng,
  player: PlayerMatchProfile,
  state: PlayerSeasonState,
  line: StatLine,
  teamStrength: number,
  oppStrength: number,
  knockout: boolean,
): MatchResult {
  let minutes = 0;
  let started = false;

  if (state.injuredFor > 0) {
    state.injuredFor--;
  } else if ((state.suspendedFor ?? 0) > 0) {
    state.suspendedFor = (state.suspendedFor ?? 0) - 1;
  } else {
    ({ minutes, started } = decideMinutes(rng, player, teamStrength));
  }

  const share = minutes / 90;
  const impact = teamImpact(player.ovr, teamStrength) * (started ? Math.max(share, 0.75) : share);
  const teamEff = teamStrength + impact;
  const lambdaFor = expectedGoals(teamEff, oppStrength);
  const lambdaAgainst = expectedGoals(oppStrength, teamEff);
  const scored = rng.poisson(lambdaFor);
  const conceded = rng.poisson(lambdaAgainst);
  const outcome: MatchResult['outcome'] = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
  const advanced = outcome === 'W' || (knockout && outcome === 'D' && rng.chance(0.5));

  if (minutes === 0) return { scored, conceded, outcome, advanced, minutes: 0, rating: 0, goals: 0, assists: 0 };

  const pos = POSITIONS[player.position];
  const inv = involvement(player, teamStrength);
  const momentum = state.momentum ?? 0;
  const formMult = clamp(1 + player.form * STATS.formProduction + momentum, 0.6, 1.5) * (player.shareScale ?? 1);
  const pGoal = clamp((inv.goal + (inv.goal > 0 ? player.goalBonus : 0)) * formMult, 0, STATS.maxGoalShare);
  const pAssist = clamp(inv.assist * formMult, 0, STATS.maxInvolvement - pGoal);

  // Cada gol do time acontece num minuto qualquer: o jogador participa se estiver em campo.
  let goals = 0;
  let assists = 0;
  for (let g = 0; g < scored; g++) {
    if (!rng.chance(share)) continue;
    const r = rng.next();
    if (r < pGoal) goals++;
    else if (r < pGoal + pAssist) assists++;
  }

  // Finalizações: os gols + as chances desperdiçadas (pela conversão).
  const xg = pGoal * lambdaFor * share;
  const shots = goals + rng.poisson(Math.max(0, xg / inv.conversion - xg));
  // Ações defensivas crescem quando o adversário é mais forte (menos posse).
  const pressure = clamp(Math.exp((oppStrength - teamEff) / STATS.pressureScale), 0.6, 1.7);
  const attackTilt = clamp(Math.sqrt(lambdaFor / MATCH.baseGoals), 0.7, 1.4);
  const expKeyPasses = inv.keyPasses * attackTilt * formMult * share;
  const keyPasses = assists + rng.poisson(Math.max(0, expKeyPasses - pAssist * lambdaFor * share));
  const expTackles = inv.tackles * pressure * share;
  const expInterceptions = inv.interceptions * pressure * share;
  const expClearances = inv.clearances * pressure ** 1.3 * share;
  const tackles = rng.poisson(expTackles);
  const interceptions = rng.poisson(expInterceptions);
  const clearances = rng.poisson(expClearances);

  const keeper = pos.group === 'gk';
  const onPitchConceded = keeper ? conceded : 0;
  const saves = keeper ? rng.poisson(lambdaAgainst * (inv.savePct / (1 - inv.savePct)) * share) : 0;

  const cleanSheet = conceded === 0 && minutes >= 60;
  const defensive = pos.group === 'gk' || pos.group === 'def';
  const actions =
    (keyPasses - expKeyPasses) * 0.12 +
    (tackles + interceptions - expTackles - expInterceptions) * 0.07 +
    (clearances - expClearances) * 0.025 +
    (keeper ? (saves - lambdaAgainst * 2) * 0.12 : 0) +
    (shots - goals > 4 ? -0.15 : 0);
  let rating =
    MATCH.ratingBase +
    (player.ovr - MATCH.ratingOvrPivot) * MATCH.ratingPerOvr +
    (teamEff - oppStrength) * 0.01 +
    goals * MATCH.goalRating +
    assists * MATCH.assistRating +
    actions +
    (outcome === 'W' ? MATCH.winRating : outcome === 'L' ? -MATCH.winRating : 0) +
    (cleanSheet && defensive ? MATCH.cleanSheetRating : 0) -
    (defensive ? Math.max(0, conceded - 1) * 0.2 : 0) +
    rng.normal(player.form * 0.6, MATCH.ratingNoise);
  if (!started) rating = 6.3 + (rating - 6.3) * 0.5;
  rating = clamp(rating, 3.5, 10);

  line.apps++;
  if (started) line.starts++;
  line.minutes += minutes;
  line.goals += goals;
  line.assists += assists;
  line.shots += shots;
  line.keyPasses += keyPasses;
  line.tackles += tackles;
  line.interceptions += interceptions;
  line.clearances += clearances;
  line.saves += saves;
  line.conceded += onPitchConceded;
  if (cleanSheet && defensive) line.cleanSheets++;
  line.ratingSum += rating;

  // Cartões: posição + quantidade de duelos defensivos na partida.
  const duelF = 0.75 + 0.12 * tackles;
  if (rng.chance(MATCH.yellowPer90 * pos.cardRisk * duelF * share)) line.yellow++;
  if (rng.chance(MATCH.redPer90 * pos.cardRisk * duelF * share)) {
    line.red++;
    state.suspendedFor = (state.suspendedFor ?? 0) + rng.int(1, 2);
  }

  // Fase: atuações acima/abaixo do esperado alimentam a sequência seguinte.
  const expected = MATCH.ratingBase + (player.ovr - MATCH.ratingOvrPivot) * MATCH.ratingPerOvr;
  state.momentum = clamp(
    momentum * STATS.momentumDecay + (rating - expected) * STATS.momentumWeight * 0.1 * share,
    -STATS.momentumCap,
    STATS.momentumCap,
  );

  const phy = player.attributes.phy ?? 60;
  const ageRisk = player.age >= 30 ? 1 + (player.age - 29) * 0.12 : 1;
  const pInjury = MATCH.injuryPerMatch * (1 + (70 - phy) / 60) * ageRisk * player.injuryRisk * share;
  if (rng.chance(pInjury)) {
    const sev = rng.weighted(INJURY_SEVERITY, (s) => s.chance);
    const games = rng.int(sev.min, sev.max);
    state.injuredFor = games;
    state.injuries.push({ label: sev.label, games });
    state.momentum = Math.min(0, state.momentum ?? 0);
  }

  return { scored, conceded, outcome, advanced, minutes, rating, goals, assists };
}

import { FINANCE, MARKET, PLAYING_TIME } from '../config/balance';
import { getLeague } from '../data/clubs';
import type { Club, PositionId } from '../types';
import { clamp, sigmoid, type Rng } from './rng';

export function marketValue(ovr: number, age: number, reputation: number): number {
  const base = MARKET.baseValue * Math.exp((ovr - MARKET.ovrPivot) / MARKET.ovrScale);
  const ageF = MARKET.ageFactor.find((a) => age <= a.maxAge)?.f ?? 0.15;
  const repF = 0.85 + reputation / 400;
  return roundMoney(base * ageF * repF);
}

/**
 * Poder financeiro do clube (0–1): reputação (marca, receitas) e nível salarial da liga.
 * Não é a força do elenco — um clube pode ser forte com orçamento menor, ou o contrário.
 */
export function clubFinance(club: Club): number {
  const rep = clamp((club.reputation - FINANCE.repFloor) / (FINANCE.repTop - FINANCE.repFloor), 0, 1);
  const league = clamp(getLeague(club.leagueId).wageLevel / FINANCE.wageTop, 0, 1);
  return rep * FINANCE.repWeight + league * (1 - FINANCE.repWeight);
}

/** Quanto o clube costuma conseguir investir numa transferência (referência suave, não um teto rígido). */
export function transferBudget(club: Club): number {
  return FINANCE.budgetBase * Math.exp(clubFinance(club) * FINANCE.budgetScale);
}

/**
 * Valor da proposta: valor de mercado com variação aleatória. Clubes mais ricos tendem a pagar
 * um pouco mais, e o que passa do orçamento do clube entra só em parte na proposta.
 */
export function transferFee(value: number, club: Club, rng: Rng): number {
  const f = clubFinance(club);
  const noise = rng.range(FINANCE.noiseMin + f * FINANCE.noiseMinPerFinance, FINANCE.noiseMax + f * FINANCE.noiseMaxPerFinance);
  const raw = value * MARKET.feeMultiplier * noise;
  const budget = transferBudget(club);
  return raw <= budget ? raw : budget + (raw - budget) * FINANCE.overBudgetShare;
}

export function weeklyWage(ovr: number, reputation: number, wageLevel: number): number {
  const base = MARKET.wageBase + Math.max(0, ovr - 55) ** 2 * MARKET.wagePerOvrSq;
  return roundMoney(base * wageLevel * (0.9 + reputation / 500));
}

/** Titularidade esperada (0–1) dado o OVR, a força do clube e a posição. */
export function expectedStartShare(ovr: number, clubStrength: number, coachTrust = 50, position?: PositionId): number {
  const keeper = position === 'GOL';
  const offset = keeper ? PLAYING_TIME.keeperOffset : PLAYING_TIME.offset;
  const scale = keeper ? PLAYING_TIME.keeperScale : PLAYING_TIME.scale;
  const raw = sigmoid((ovr - clubStrength + offset) / scale);
  return clamp(raw + (coachTrust - 50) * PLAYING_TIME.trustWeight, PLAYING_TIME.min, PLAYING_TIME.max);
}

export type Exposure = 'Baixa' | 'Média' | 'Alta';

export function clubExposure(club: Club): Exposure {
  const score = getLeague(club.leagueId).strength * 0.6 + club.reputation * 0.4;
  if (score >= 84) return 'Alta';
  if (score >= 72) return 'Média';
  return 'Baixa';
}

/** Chance aproximada de títulos do clube, para exibição nas propostas. */
export function titleChance(club: Club): 'Baixa' | 'Média' | 'Alta' {
  const league = getLeague(club.leagueId);
  const rel = club.strength - league.strength;
  if (rel >= 4) return 'Alta';
  if (rel >= 0) return 'Média';
  return 'Baixa';
}

function roundMoney(v: number): number {
  if (v >= 1_000_000) return Math.round(v / 100_000) * 100_000;
  if (v >= 10_000) return Math.round(v / 1_000) * 1_000;
  return Math.round(v / 100) * 100;
}

export function formatMoney(v: number): string {
  if (v >= 1_000_000_000) return `€${(v / 1_000_000_000).toFixed(2)} bi`;
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)} mi`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)} mil`;
  return `€${v}`;
}

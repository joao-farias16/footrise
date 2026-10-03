import { EVOLUTION, START_FACTOR, START_NOISE } from '../config/balance';
import { attrKeysFor } from '../config/positions';
import type { AttrKey, Attributes, PositionId } from '../types';
import { clamp, type Rng } from './rng';

export function growthRate(age: number): number {
  return EVOLUTION.growthByAge.find((g) => age <= g.maxAge)?.rate ?? 0;
}

export function declineStartAge(position: PositionId): number {
  return position === 'GOL' ? EVOLUTION.keeperDeclineStartAge : EVOLUTION.declineStartAge;
}

/** Atributos iniciais: uma fração do potencial que depende da idade. */
export function initialAttributes(potential: Attributes, position: PositionId, age: number, rng: Rng): Attributes {
  const factor = START_FACTOR[clamp(age, 16, 20)] ?? START_FACTOR[18];
  const attrs: Attributes = {};
  for (const key of attrKeysFor(position)) {
    const pot = potential[key] ?? 50;
    attrs[key] = clamp(Math.round(pot * factor + rng.range(-START_NOISE, START_NOISE)), 25, pot);
  }
  return attrs;
}

export interface EvolutionInput {
  attributes: Attributes;
  potential: Attributes;
  position: PositionId;
  /** Idade durante a temporada que acabou. */
  age: number;
  minutes: number;
  rating: number;
  leagueStrength: number;
}

export function evolveAttributes(input: EvolutionInput, rng: Rng): { attributes: Attributes; delta: Attributes } {
  const { attributes, potential, position, age, minutes, rating, leagueStrength } = input;
  const next: Attributes = {};
  const delta: Attributes = {};
  const minutesF = EVOLUTION.minMinutesFactor + (1 - EVOLUTION.minMinutesFactor) * Math.min(1, minutes / EVOLUTION.fullMinutes);
  const playedRating = minutes > 0 ? rating : EVOLUTION.ratingPivot - 0.3;
  const perfF = clamp(1 + (playedRating - EVOLUTION.ratingPivot) * EVOLUTION.ratingWeight, EVOLUTION.perfMin, EVOLUTION.perfMax);
  const levelF = clamp(0.85 + (leagueStrength - 70) / 100, 0.8, 1.05);
  const rate = growthRate(age);
  const declineAge = declineStartAge(position);

  for (const key of attrKeysFor(position)) {
    const current = attributes[key] ?? 50;
    let d = 0;
    if (rate > 0) {
      const ceiling = (potential[key] ?? current) + (playedRating >= EVOLUTION.overPotentialRating ? EVOLUTION.overPotentialCap : 0);
      const gap = ceiling - current;
      if (gap > 0) {
        d = Math.round(gap * rate * minutesF * perfF * levelF + rng.normal(0, EVOLUTION.noise * 0.5));
        d = clamp(d, 0, gap);
      }
    }
    if (age >= declineAge) {
      const years = age - declineAge + 1;
      const perYear = EVOLUTION.declinePerYear[key as AttrKey] ?? 0.5;
      const resilience = clamp(1.15 - (perfF - 1) * 0.5, 0.8, 1.3);
      d -= Math.round(perYear * years * resilience * rng.range(0.6, 1.4));
    }
    next[key] = clamp(current + d, 20, 99);
    delta[key] = (next[key] ?? 0) - current;
  }
  return { attributes: next, delta };
}

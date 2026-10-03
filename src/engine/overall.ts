import { POSITIONS, attrKeysFor } from '../config/positions';
import type { AttrKey, Attributes, PositionId } from '../types';

/** Overall ponderado pela posição. Atributos ausentes contam como `fallback`. */
export function computeOverall(attrs: Attributes, position: PositionId, fallback = 0): number {
  const weights = POSITIONS[position].weights;
  let total = 0;
  for (const key of attrKeysFor(position)) {
    total += (weights[key] ?? 0) * (attrs[key] ?? fallback);
  }
  return Math.round(total);
}

/** Overall sem arredondamento — útil para comparar ganhos pequenos no draft. */
export function computeOverallExact(attrs: Attributes, position: PositionId, fallback = 0): number {
  const weights = POSITIONS[position].weights;
  return attrKeysFor(position).reduce((s, key) => s + (weights[key] ?? 0) * (attrs[key] ?? fallback), 0);
}

export function attrWeight(position: PositionId, key: AttrKey): number {
  return POSITIONS[position].weights[key] ?? 0;
}

/** Classifica o peso de um atributo para exibição. */
export function weightTier(position: PositionId, key: AttrKey): 'alta' | 'média' | 'baixa' {
  const w = attrWeight(position, key);
  if (w >= 0.2) return 'alta';
  if (w >= 0.1) return 'média';
  return 'baixa';
}

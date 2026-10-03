import type { Career, ShirtNumberRecord } from '../types';
import { clamp, type Rng } from './rng';

// Números de camisa. O jogador escolhe um número preferido na criação; ao chegar a um
// clube (ou à seleção) o número pode estar ocupado — craques costumam conseguir o seu.

const ALTERNATIVES = [7, 9, 10, 11, 8, 17, 19, 20, 21, 22, 23, 14, 16, 18, 27, 29, 30, 77, 99];
const KEEPER_ALTERNATIVES = [1, 12, 13, 25, 31, 33, 99];

/** Número que o jogador usa hoje no clube (último registrado) ou o preferido. */
export function currentShirtNumber(c: Career): number {
  const club = [...(c.shirtNumbers ?? [])].reverse().find((r) => r.kind === 'club' && r.clubId === c.clubId);
  return club?.number ?? c.profile.number;
}

function pickNumber(c: Career, rng: Rng, takenChance: number): number {
  const preferred = c.profile.number;
  if (!rng.chance(takenChance)) return preferred;
  const pool = (c.position === 'GOL' ? KEEPER_ALTERNATIVES : ALTERNATIVES).filter((n) => n !== preferred);
  // Variação natural do preferido (ex.: 9 → 19, 99) entra entre as opções.
  if (preferred + 10 <= 99) pool.unshift(preferred + 10);
  return rng.pick(pool);
}

/**
 * Registra o número ao chegar a um clube. Voltar a um clube onde já jogou mantém o número antigo.
 * Muta a carreira.
 */
export function assignClubNumber(c: Career, clubId: string, clubName: string, season: string, rng: Rng): number {
  c.shirtNumbers ??= [];
  const previous = [...c.shirtNumbers].reverse().find((r) => r.kind === 'club' && r.clubId === clubId);
  const last = c.shirtNumbers[c.shirtNumbers.length - 1];
  if (previous) {
    if (last !== previous) c.shirtNumbers.push({ ...previous, since: season });
    return previous.number;
  }
  const takenChance = clamp(0.35 - c.reputation / 250, 0.05, 0.35);
  const number = pickNumber(c, rng, takenChance);
  c.shirtNumbers.push({ team: clubName, clubId, kind: 'club', number, since: season });
  return number;
}

/** Na primeira convocação, define o número na seleção. Muta a carreira. */
export function assignNationalNumber(c: Career, countryName: string, season: string, rng: Rng): number {
  c.shirtNumbers ??= [];
  const existing = c.shirtNumbers.find((r) => r.kind === 'national');
  if (existing) return existing.number;
  const takenChance = clamp(0.45 - c.reputation / 200, 0.05, 0.45);
  const number = pickNumber(c, rng, takenChance);
  c.shirtNumbers.push({ team: countryName, kind: 'national', number, since: season });
  return number;
}

/** Números usados, sem repetições consecutivas por time (para exibição). */
export function shirtHistory(c: Career): ShirtNumberRecord[] {
  if (c.shirtNumbers && c.shirtNumbers.length > 0) {
    const out: ShirtNumberRecord[] = [];
    for (const r of c.shirtNumbers) {
      const prev = out.find((o) => o.kind === r.kind && o.team === r.team && o.number === r.number);
      if (!prev) out.push(r);
    }
    return out;
  }
  // Saves antigos: só existia o número escolhido na criação.
  const clubs: ShirtNumberRecord[] = [];
  for (const s of c.seasons) {
    if (!clubs.some((r) => r.clubId === s.clubId)) {
      clubs.push({ team: s.clubName, clubId: s.clubId, kind: 'club', number: c.profile.number, since: s.season });
    }
  }
  return clubs;
}

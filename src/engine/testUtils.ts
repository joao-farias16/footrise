import { OUTFIELD_KEYS } from '../config/positions';
import type { Career, PlayerProfile, PositionId } from '../types';
import { chooseInitialClub, createCareer, draftPick, goToClubChoice } from './career';

export function profile(position: PositionId = 'ATA', nationality = 'BRA', startAge = 18): PlayerProfile {
  return { name: 'Teste Silva', nationality, startAge, position, foot: 'D', number: 9 };
}

/** Carreira pronta no hub, com o draft feito e o primeiro clube escolhido. */
export function hubCareer(position: PositionId = 'ATA', seed = 1, offerIndex = 1): Career {
  let c = createCareer(profile(position), 'analyst', seed);
  while (c.phase === 'draft') c = draftPick(c, 0);
  c = goToClubChoice(c);
  return chooseInitialClub(c, c.offers[offerIndex].id);
}

/** Força atributos uniformes (útil para comparar jogadores bons e fracos). */
export function withAttributes(c: Career, value: number, clubId?: string): Career {
  const next = structuredClone(c);
  for (const k of OUTFIELD_KEYS) {
    next.attributes[k] = value;
    next.potential[k] = Math.max(value, next.potential[k] ?? 0);
  }
  if (clubId) next.clubId = clubId;
  return next;
}

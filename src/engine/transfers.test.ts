import { describe, expect, it } from 'vitest';
import { getClub } from '../data/clubs';
import type { Career, SeasonRecord } from '../types';
import {
  acceptOffer,
  chooseEventOption,
  chooseInitialClub,
  continueAfterEvent,
  continueAfterReview,
  createCareer,
  draftPick,
  goToClubChoice,
  startSeason,
  stayAtClub,
} from './career';
import { initialOffers, seasonOffers } from './offers';
import { Rng } from './rng';
import { hubCareer, profile, withAttributes } from './testUtils';

/** Avança a carreira um passo, sempre escolhendo a primeira opção dos eventos. */
function advance(c: Career): Career {
  if (c.phase === 'hub') return startSeason(c);
  if (c.phase === 'event') return c.events[c.eventIndex]?.resolved ? continueAfterEvent(c) : chooseEventOption(c, 0);
  if (c.phase === 'season-review') return continueAfterReview(c);
  return c;
}

function playUntilOffers(seed: number): Career {
  let c = hubCareer('ATA', seed);
  for (let i = 0; i < 40 && c.phase !== 'offers'; i++) c = advance(c);
  return c;
}

describe('clubes e transferências', () => {
  it('propostas iniciais têm perfis distintos: protagonismo x vitrine', () => {
    let c = createCareer(profile('PD'), 'analyst', 21);
    while (c.phase === 'draft') c = draftPick(c, 0);
    const offers = initialOffers(c, new Rng(1));
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => o.clubId)).size).toBe(3);
    const strengths = offers.map((o) => getClub(o.clubId)!.strength);
    expect(strengths[2]).toBeGreaterThan(strengths[0]);
    expect(offers[0].startShare).toBeGreaterThan(offers[2].startShare);
  });

  it('escolher o clube inicial leva ao hub', () => {
    let c = createCareer(profile('ZAG'), 'analyst', 3);
    while (c.phase === 'draft') c = draftPick(c, 0);
    c = goToClubChoice(c);
    const offer = c.offers[0];
    c = chooseInitialClub(c, offer.id);
    expect(c.phase).toBe('hub');
    expect(c.clubId).toBe(offer.clubId);
    expect(c.weeklyWage).toBe(offer.weeklyWage);
  });

  it('uma boa temporada gera propostas e aceitar muda de clube', () => {
    let found = false;
    for (let seed = 1; seed < 15 && !found; seed++) {
      const c = playUntilOffers(seed);
      if (c.phase !== 'offers') continue;
      found = true;
      const offer = c.offers.find((o) => o.kind === 'transfer') ?? c.offers[0];
      const before = c.clubId;
      const after = acceptOffer(c, offer.id);
      expect(after.phase).toBe('hub');
      expect(after.clubId).toBe(offer.clubId);
      expect(after.transfers.at(-1)).toMatchObject({ fromClubId: before, toClubId: offer.clubId });
      const stayed = stayAtClub(c);
      expect(stayed.clubId).toBe(before);
      expect(stayed.phase).toBe('hub');
    }
    expect(found).toBe(true);
  });

  it('jovem reserva recebe proposta de empréstimo e volta ao clube depois', () => {
    const base = withAttributes(hubCareer('MEI', 9), 66, 'manchester-city');
    base.age = 19;
    const last = { rating: 6.4, apps: 8 } as SeasonRecord;
    const offers = seasonOffers(base, last, new Rng(2));
    const loan = offers.find((o) => o.kind === 'loan');
    expect(loan).toBeDefined();

    const inOffers = { ...base, phase: 'offers' as const, offers };
    const loaned = acceptOffer(inOffers, loan!.id);
    expect(loaned.clubId).toBe(loan!.clubId);
    expect(loaned.parentClubId).toBe('manchester-city');

    // Depois da temporada, o empréstimo termina.
    let c = advance(loaned);
    for (let i = 0; i < 8 && c.phase !== 'season-review'; i++) c = advance(c);
    c = continueAfterReview(c);
    expect(c.clubId).toBe('manchester-city');
    expect(c.parentClubId).toBeNull();
  });

  it('veterano em queda não recebe propostas', () => {
    const old = withAttributes(hubCareer('ATA', 2), 55);
    old.age = 35;
    expect(seasonOffers(old, { rating: 6.2, apps: 10 } as SeasonRecord, new Rng(1))).toHaveLength(0);
  });
});

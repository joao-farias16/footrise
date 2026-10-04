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
import { clubFinance, marketValue, transferBudget, transferFee } from './market';
import { declineFactor, initialClubPool, initialOffers, originClubId, seasonOffers } from './offers';
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

describe('mercado de fim de carreira', () => {
  /** Atacante de OVR `ovr` num clube estrangeiro, revelado pelo clube `origin`. */
  function veteran(nationality: string, age: number, ovr: number, peak: number, origin: string): Career {
    const c = withAttributes(hubCareer('ATA', 5), ovr, 'manchester-city');
    c.profile.nationality = nationality;
    c.age = age;
    c.peakOvr = peak;
    c.reputation = 80;
    c.seasons = [{ clubId: origin } as SeasonRecord];
    c.transfers = [
      { season: '2030/31', fromClubId: origin, toClubId: 'arsenal', fee: 0, kind: 'transfer' },
      { season: '2033/34', fromClubId: 'arsenal', toClubId: 'manchester-city', fee: 0, kind: 'transfer' },
    ];
    return c;
  }
  const season = (ovrStart: number, ovrEnd: number, rating = 6.9) => ({ rating, apps: 30, ovrStart, ovrEnd }) as SeasonRecord;

  function market(c: Career, last: SeasonRecord, runs = 600) {
    const home = new Set(initialClubPool(c.profile.nationality).map((x) => x.id));
    let total = 0;
    let national = 0;
    let origin = 0;
    for (let i = 1; i <= runs; i++) {
      const offers = seasonOffers(c, last, new Rng(i));
      total += offers.length;
      national += offers.filter((o) => home.has(o.clubId)).length;
      if (offers.some((o) => o.clubId === originClubId(c))) origin++;
    }
    return { national: national / runs, nationalShare: total ? national / total : 0, origin: origin / runs };
  }

  it('identifica o clube de origem mesmo depois de várias transferências', () => {
    expect(originClubId(veteran('BRA', 35, 80, 92, 'santos'))).toBe('santos');
    const fresh = hubCareer('ATA', 5);
    expect(originClubId(fresh)).toBe(fresh.clubId);
  });

  it('o declínio cresce aos poucos e não depende só da idade', () => {
    const c = veteran('BRA', 22, 78, 78, 'santos');
    expect(declineFactor(c, season(74, 78))).toBe(0);
    expect(declineFactor({ ...c, age: 28, peakOvr: 90 }, season(89, 90))).toBe(0);
    // Veterano que mantém o nível ainda não está em declínio.
    expect(declineFactor({ ...c, age: 35, peakOvr: 85 }, season(85, 85), 85)).toBe(0);
    const starting = declineFactor({ ...c, age: 32, peakOvr: 90 }, season(89, 87), 87);
    const veteranDecline = declineFactor({ ...c, age: 35, peakOvr: 92 }, season(84, 80), 80);
    const older = declineFactor({ ...c, age: 38, peakOvr: 92 }, season(74, 70, 6.6), 70);
    expect(starting).toBeGreaterThan(0);
    expect(veteranDecline).toBeGreaterThan(starting);
    expect(older).toBeGreaterThanOrEqual(veteranDecline);
    expect(older).toBeLessThanOrEqual(1);
  });

  it('veterano em declínio recebe mais propostas do país, em várias nacionalidades', () => {
    for (const [nat, origin] of [['BRA', 'santos'], ['ARG', initialClubPool('ARG')[2].id], ['JPN', initialClubPool('JPN')[1].id]]) {
      const prime = market(veteran(nat, 28, 90, 90, origin), season(89, 90, 7.4));
      const late = market(veteran(nat, 36, 76, 92, origin), season(80, 76));
      expect(late.national, nat).toBeGreaterThan(prime.national + 0.2);
      expect(late.nationalShare, nat).toBeGreaterThan(prime.nationalShare);
    }
  });

  it('o clube de origem pode fazer proposta, mas o retorno nunca é garantido', () => {
    const c = veteran('BRA', 36, 76, 92, 'santos');
    const { origin } = market(c, season(80, 76));
    expect(origin).toBeGreaterThan(0.15);
    expect(origin).toBeLessThan(0.8);
    expect(market(veteran('BRA', 27, 90, 90, 'santos'), season(88, 90, 7.4)).origin).toBeLessThan(0.05);
  });

  it('propostas nacionais seguem compatíveis com o nível atual do jogador', () => {
    const c = veteran('BRA', 37, 66, 92, 'santos');
    const home = new Set(initialClubPool('BRA').map((x) => x.id));
    for (let i = 1; i <= 300; i++) {
      for (const o of seasonOffers(c, season(71, 66), new Rng(i))) {
        if (!home.has(o.clubId) || o.clubId === 'santos') continue;
        expect(getClub(o.clubId)!.strength).toBeLessThanOrEqual(66 + 12);
      }
    }
  });
});

describe('economia das transferências', () => {
  const club = (id: string) => getClub(id)!;
  function fees(value: number, id: string, runs = 2000) {
    const rng = new Rng(11);
    const xs = Array.from({ length: runs }, () => transferFee(value, club(id), rng)).sort((a, b) => a - b);
    return { min: xs[0], median: xs[runs >> 1], max: xs[runs - 1] };
  }

  it('poder financeiro não é o mesmo que força do elenco', () => {
    // Leverkusen é tão forte quanto o Atlético, mas tem menos dinheiro que os gigantes.
    expect(club('bayer-leverkusen').strength).toBeGreaterThanOrEqual(club('atletico-de-madrid').strength);
    expect(clubFinance(club('bayer-leverkusen'))).toBeLessThan(clubFinance(club('atletico-de-madrid')));
    expect(transferBudget(club('real-madrid'))).toBeGreaterThan(transferBudget(club('bayer-leverkusen')) * 1.6);
    expect(transferBudget(club('bayer-leverkusen'))).toBeGreaterThan(transferBudget(club('celtic')));
  });

  it('por um craque, clubes ricos disputam mais alto e os menores ficam abaixo deles', () => {
    const value = marketValue(92, 24, 90);
    const real = fees(value, 'real-madrid');
    const b04 = fees(value, 'bayer-leverkusen');
    const celtic = fees(value, 'celtic');
    expect(real.median).toBeGreaterThan(b04.max);
    expect(b04.median).toBeGreaterThan(celtic.median);
    // Proposta altíssima segue possível, e o clube menor ainda oferece um valor relevante.
    expect(real.max).toBeGreaterThan(value * 1.3);
    expect(b04.median).toBeGreaterThan(value * 0.8);
    // Nunca é um valor fixo por clube.
    for (const f of [real, b04, celtic]) expect(f.max - f.min).toBeGreaterThan(value * 0.05);
  });

  it('jogadores de valor comum custam praticamente o mesmo para qualquer comprador', () => {
    const value = marketValue(78, 25, 40);
    const rich = fees(value, 'manchester-city');
    const small = fees(value, 'celtic');
    expect(small.median / rich.median).toBeGreaterThan(0.93);
    expect(small.min).toBeGreaterThan(value * 0.85);
  });
});

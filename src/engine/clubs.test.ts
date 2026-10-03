import { describe, expect, it } from 'vitest';
import { CLUB_BY_ID, CLUBS, clubsOfCountry, getClub, LEAGUES, LEGACY_CLUB_IDS } from '../data/clubs';
import { COUNTRY_BY_CODE, SELECTABLE_COUNTRIES } from '../data/countries';
import { chooseInitialClub, createCareer, draftPick, goToClubChoice } from './career';
import { initialOffers } from './offers';
import { Rng } from './rng';
import { profile } from './testUtils';

describe('clubes reais', () => {
  it('ids únicos, ligas válidas e características coerentes', () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUBS.length);
    for (const c of CLUBS) {
      expect(LEAGUES.some((l) => l.id === c.leagueId)).toBe(true);
      expect(COUNTRY_BY_CODE[c.country]).toBeDefined();
      expect(c.strength).toBeGreaterThanOrEqual(40);
      expect(c.strength).toBeLessThanOrEqual(95);
    }
    // Gigantes reais no topo das suas ligas.
    expect(getClub('real-madrid')!.strength).toBeGreaterThan(getClub('getafe')!.strength);
    expect(getClub('flamengo')!.country).toBe('BRA');
    expect(getClub('toronto-fc')!.country).toBe('CAN');
  });

  it('todo país selecionável tem clubes próprios, em níveis diferentes', () => {
    for (const country of SELECTABLE_COUNTRIES) {
      const clubs = clubsOfCountry(country.code);
      expect(clubs.length, country.name).toBeGreaterThanOrEqual(3);
      expect(new Set(clubs.map((c) => c.strength)).size, country.name).toBeGreaterThanOrEqual(2);
    }
  });

  it('clubes fictícios antigos apontam para clubes reais', () => {
    for (const [oldId, newId] of Object.entries(LEGACY_CLUB_IDS)) {
      expect(CLUB_BY_ID[newId], oldId).toBeDefined();
      expect(getClub(oldId)?.id).toBe(newId);
    }
    expect(getClub('kingsport-city')?.name).toBe('Manchester City');
  });
});

describe('clube inicial pela nacionalidade', () => {
  const draftDone = (nat: string, seed: number) => {
    let c = createCareer(profile('ATA', nat), 'analyst', seed);
    while (c.phase === 'draft') c = draftPick(c, 0);
    return c;
  };

  it.each(['BRA', 'ESP', 'ENG', 'GER', 'FRA', 'ITA'])('as 3 opções iniciais são de clubes de %s', (nat) => {
    for (let seed = 1; seed <= 6; seed++) {
      const c = goToClubChoice(draftDone(nat, seed));
      expect(c.offers).toHaveLength(3);
      expect(new Set(c.offers.map((o) => o.clubId)).size).toBe(3);
      for (const o of c.offers) expect(getClub(o.clubId)!.country).toBe(nat);
      const strengths = c.offers.map((o) => getClub(o.clubId)!.strength);
      // Segura → intermediária → ambiciosa.
      expect(strengths[0]).toBeLessThanOrEqual(strengths[1]);
      expect(strengths[1]).toBeLessThanOrEqual(strengths[2]);
      expect(strengths[2]).toBeGreaterThan(strengths[0]);
      // Depois de assinar, o jogador está mesmo no clube escolhido.
      const hub = chooseInitialClub(c, c.offers[2].id);
      expect(getClub(hub.clubId)!.country).toBe(nat);
    }
  });

  it('vale para todas as nacionalidades selecionáveis', () => {
    const base = draftDone('BRA', 7);
    for (const country of SELECTABLE_COUNTRIES) {
      const c = { ...base, profile: { ...base.profile, nationality: country.code } };
      const offers = initialOffers(c, new Rng(3));
      expect(offers).toHaveLength(3);
      for (const o of offers) expect(getClub(o.clubId)!.country, country.name).toBe(country.code);
    }
  });
});

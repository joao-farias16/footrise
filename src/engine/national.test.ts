import { describe, expect, it } from 'vitest';
import { getCountry } from '../data/countries';
import type { Career, PositionId } from '../types';
import { autoplayCareer } from './autoplay';
import { continueAfterEvent, chooseEventOption, continueAfterReview, startSeason, stayAtClub } from './career';
import { computeLegacy, legacyInputFromCareer } from './legacy';
import { emptyStatLine, type PlayerMatchProfile } from './match';
import { NationalSeasonSim, nationalCalendar, seasonCampaigns, simulateNationalSeason, tournamentFor } from './national';
import { Rng } from './rng';
import { nationalSummary } from './summary';
import { hubCareer, profile } from './testUtils';

const star = (position: PositionId = 'ATA', ovr = 90): PlayerMatchProfile => ({
  ovr,
  position,
  attributes: { sho: ovr + 2, pac: ovr, dri: ovr, phy: ovr - 5, pas: ovr - 5, def: 50 },
  age: 26,
  startShare: 0.9,
  form: 0,
  injuryRisk: 1,
  goalBonus: 0,
});

describe('calendário internacional', () => {
  it('ciclo de 4 anos: eliminatórias → Copa do Mundo; continental no ano certo', () => {
    expect(tournamentFor(2030, 'BRA')?.name).toBe('Copa do Mundo');
    expect(tournamentFor(2028, 'BRA')?.name).toBe('Copa América');
    expect(tournamentFor(2028, 'ESP')?.name).toBe('Eurocopa');
    expect(tournamentFor(2031, 'USA')?.name).toBe('Copa Ouro');
    expect(tournamentFor(2029, 'BRA')).toBeNull();

    const bra = getCountry('BRA');
    expect(seasonCampaigns(2029, bra).map((c) => c.name)).toContain('Eliminatórias da Copa do Mundo');
    expect(seasonCampaigns(2030, bra).find((c) => c.kind === 'qualifier')?.closes).toBe(true);
    const esp = getCountry('ESP');
    expect(seasonCampaigns(2029, esp).map((c) => c.name)).toContain('Liga das Nações da UEFA');
    expect(seasonCampaigns(2028, esp).map((c) => c.name)).toContain('Eliminatórias da Eurocopa');
    expect(nationalCalendar(2030, 'BRA').join(' ')).toContain('Copa do Mundo 2030');
  });
});

describe('seleção na temporada', () => {
  it('craque de seleção forte é convocado, joga, marca e disputa a Copa', () => {
    let wcPlayed = 0;
    let caps = 0;
    let called = 0;
    for (let s = 0; s < 12; s++) {
      const r = simulateNationalSeason(new Rng(s), star(), { injuredFor: 0, injuries: [] }, 'BRA', 80, 2030, 0, [{ id: 'wc-2030', points: 18, games: 8 }], '2029/30');
      if (r.season.calledUp) called++;
      caps += r.season.caps;
      expect(r.season.starts!).toBeLessThanOrEqual(r.season.caps);
      const wc = r.season.competitions!.find((c) => c.kind === 'worldCup');
      if (wc?.inSquad) {
        wcPlayed++;
        if (wc.won) expect(r.trophies.some((t) => t.kind === 'worldCup')).toBe(true);
      }
      // Título só conta para quem estava no elenco.
      if (wc && !wc.inSquad) expect(r.trophies.some((t) => t.kind === 'worldCup')).toBe(false);
    }
    expect(called).toBeGreaterThanOrEqual(11);
    expect(caps / 12).toBeGreaterThan(6);
    expect(wcPlayed).toBeGreaterThan(8);
  });

  it('jogador fraco não é convocado, mas a seleção joga mesmo assim', () => {
    const r = simulateNationalSeason(new Rng(1), star('ATA', 62), { injuredFor: 0, injuries: [] }, 'BRA', 10, 2030, 0, [], '2029/30');
    expect(r.season.calledUp).toBe(false);
    expect(r.season.caps).toBe(0);
    expect(r.trophies).toHaveLength(0);
    expect(r.season.competitions!.length).toBeGreaterThan(0);
  });

  it('lesionado perde convocação', () => {
    const sim = new NationalSeasonSim(new Rng(2), star(), { injuredFor: 200, injuries: [] }, {
      nationCode: 'BRA',
      reputation: 90,
      endYear: 2029,
      season: '2028/29',
      callupBonus: 0,
      qualifiers: [],
    });
    const r = sim.finish(emptyStatLine(), 0);
    expect(r.season.calledUp).toBe(false);
    expect(r.season.missedInjured).toBeGreaterThan(0);
  });

  it('as eliminatórias acumulam pontos entre temporadas', () => {
    const r = simulateNationalSeason(new Rng(4), star(), { injuredFor: 0, injuries: [] }, 'ESP', 70, 2029, 0, [], '2028/29');
    const q = r.qualifiers.find((x) => x.id === 'wc-2030');
    expect(q).toBeDefined();
    expect(q!.games).toBeGreaterThan(0);
    const next = simulateNationalSeason(new Rng(5), star(), { injuredFor: 0, injuries: [] }, 'ESP', 70, 2030, 0, r.qualifiers, '2029/30');
    // Campanha encerrada: sai do progresso.
    expect(next.qualifiers.find((x) => x.id === 'wc-2030')).toBeUndefined();
  });
});

function advance(c: Career): Career {
  if (c.phase === 'hub') return startSeason(c);
  if (c.phase === 'event') return c.events[c.eventIndex]?.resolved ? continueAfterEvent(c) : chooseEventOption(c, 0);
  if (c.phase === 'season-review') return continueAfterReview(c);
  if (c.phase === 'offers') return stayAtClub(c);
  return c;
}

describe('seleção na carreira', () => {
  it('histórico internacional acumula convocações, jogos, gols e torneios', () => {
    let found = false;
    for (let seed = 1; seed <= 12 && !found; seed++) {
      const c = autoplayCareer(profile('ATA', 'BRA', 17), 7000 + seed);
      const n = nationalSummary(c);
      if (n.caps < 20) continue;
      found = true;
      expect(n.callups).toBeGreaterThan(0);
      expect(n.starts).toBeLessThanOrEqual(n.caps);
      const fromSeasons = c.seasons.reduce((s, x) => s + x.national.caps, 0);
      expect(n.caps).toBe(fromSeasons);
      expect(c.national.tournaments.length).toBeGreaterThan(0);
      const titles = c.trophies.filter((t) => t.team === 'Seleção');
      expect(n.titles).toHaveLength(titles.length);
    }
    expect(found).toBe(true);
  });

  it('a seleção pesa no legado: Copa do Mundo vale muito', () => {
    const c = autoplayCareer(profile('MEI', 'ESP', 17), 31);
    const base = legacyInputFromCareer(c);
    const without = computeLegacy({ ...base, trophies: base.trophies.filter((t) => t.team !== 'Seleção'), nationalCaps: 0, nationalGoals: 0, worldCups: 0, tournamentRuns: 0 });
    const withWc = computeLegacy({
      ...base,
      trophies: [...base.trophies.filter((t) => t.team !== 'Seleção'), { kind: 'worldCup', name: 'Copa do Mundo', season: '2033/34', team: 'Seleção' }],
      nationalCaps: 90,
      nationalGoals: 25,
      worldCups: 3,
      tournamentRuns: 4,
    });
    expect(withWc.score - without.score).toBeGreaterThanOrEqual(10);
  });

  it('temporada registra a campanha da seleção mesmo sem convocação', () => {
    let c = hubCareer('ATA', 2);
    for (let i = 0; i < 20 && c.seasons.length === 0; i++) c = advance(c);
    const s = c.seasons[0];
    expect(s.national.competitions!.length).toBeGreaterThan(0);
    expect(s.national.windows).toBeGreaterThan(0);
  });
});

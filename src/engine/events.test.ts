import { describe, expect, it } from 'vitest';
import { EVENT_BY_ID, EVENT_DEFS } from '../data/events';
import { CLUBS, getClub } from '../data/clubs';
import type { Career, SeasonRecord } from '../types';
import { autoplayCareer } from './autoplay';
import { eventContext, resolveEventChoice, rollEventCount, rollSeasonEvents } from './events';
import { Rng } from './rng';
import { hubCareer, profile, withAttributes } from './testUtils';

/** Temporada real de uma carreira simulada, usada como base para montar contextos. */
const SAMPLE = autoplayCareer(profile('ATA'), 3).seasons[6];

interface Setup {
  age?: number;
  last?: Partial<SeasonRecord> | null;
  caps?: number;
  reputation?: number;
  clubId?: string;
  parentClubId?: string | null;
  arrived?: boolean;
  seasonsHere?: number;
  continental?: boolean;
  /** Atributos uniformes (para um jogador mais forte que o padrão). */
  attrs?: number;
}

/** Carreira no hub com o contexto pedido (idade, última temporada, seleção, empréstimo...). */
function setup(o: Setup = {}): Career {
  const c = o.attrs ? withAttributes(hubCareer('ATA', 2), o.attrs) : structuredClone(hubCareer('ATA', 2));
  if (o.clubId) c.clubId = o.clubId;
  c.age = o.age ?? 25;
  c.reputation = o.reputation ?? 40;
  c.parentClubId = o.parentClubId ?? null;
  c.national.caps = o.caps ?? 0;
  c.continentalQualified = o.continental ?? false;
  const here = o.seasonsHere ?? 1;
  const season = (clubId: string): SeasonRecord => ({ ...structuredClone(SAMPLE), clubId, loan: false, ...(o.last ?? {}) });
  c.seasons = o.last === null ? [] : [...Array.from({ length: here }, () => season(c.clubId!))];
  if (o.arrived) {
    c.seasons = [season('santos')];
    c.transfers = [{ season: '2030/31', fromClubId: 'santos', toClubId: c.clubId!, fee: 1_000_000, kind: 'transfer' }];
  }
  return c;
}

const NEW_EVENTS = [
  'tactical_shift', 'bench_role', 'unexpected_chance', 'star_signing', 'key_player_sold', 'club_crisis', 'title_defense',
  'continental_stage', 'loan_spell', 'adaptation', 'goal_drought', 'marked_man', 'bounce_back', 'big_match_nerves',
  'milestone_goals', 'milestone_apps', 'club_tribute', 'youth_tournament', 'national_snub', 'national_veteran',
  'same_league_rival', 'homeland_call', 'transfer_rumours', 'low_form_offer', 'fatigue_warning', 'fitness_peak',
  'nagging_knock', 'veteran_leader', 'retirement_whispers',
];

/** Clube onde o jogador-base disputaria a titularidade (nem titular absoluto, nem sem espaço). */
const CONTESTED_CLUB = CLUBS.find((cl) => {
  const share = eventContext(setup({ clubId: cl.id })).startShare;
  return share >= 0.3 && share <= 0.5;
})!.id;

/** Clube fraco o bastante para o jogador-base ser titular. */
const STARTER_CLUB = CLUBS.find((cl) => eventContext(setup({ clubId: cl.id })).startShare >= 0.75)!.id;

/** Um contexto onde cada evento novo é elegível. */
const CONTEXTS: Record<string, Setup> = {
  bench_role: { clubId: 'manchester-city' },
  unexpected_chance: { clubId: CONTESTED_CLUB },
  star_signing: { clubId: 'real-madrid' },
  key_player_sold: { clubId: STARTER_CLUB },
  continental_stage: { clubId: STARTER_CLUB, continental: true },
  club_crisis: { last: { leaguePos: 18, leagueSize: 20 } },
  title_defense: { last: { trophies: [{ kind: 'league', name: 'Liga', season: '2030/31', team: 'X' }] } },
  loan_spell: { parentClubId: 'real-madrid' },
  adaptation: { arrived: true },
  goal_drought: { last: { apps: 30, goals: 3 } },
  marked_man: { last: { rating: 7.6 } },
  bounce_back: { last: { rating: 6.3 } },
  big_match_nerves: { age: 20, clubId: 'sevilla', attrs: 85 },
  milestone_goals: { last: { goals: 45 } },
  milestone_apps: { last: { apps: 95 } },
  club_tribute: { age: 29, seasonsHere: 6 },
  youth_tournament: { age: 18 },
  national_snub: { caps: 12, last: { national: { ...SAMPLE.national, calledUp: false } } },
  national_veteran: { age: 32, caps: 40, last: { national: { ...SAMPLE.national, calledUp: true } } },
  same_league_rival: { clubId: 'santos', attrs: 75 },
  homeland_call: { age: 31, clubId: 'real-madrid' },
  transfer_rumours: { reputation: 60 },
  low_form_offer: { last: { rating: 6.3 } },
  fatigue_warning: { last: { minutes: 4200, apps: 55 } },
  fitness_peak: { last: { injuries: [] } },
  nagging_knock: { age: 30 },
  veteran_leader: { age: 33 },
  retirement_whispers: { age: 35 },
};

function weight(id: string, o: Setup): number {
  return EVENT_BY_ID[id].weight(eventContext(setup(o)));
}

describe('variedade de eventos', () => {
  it('o catálogo cresceu e cada id é único', () => {
    expect(EVENT_DEFS.length).toBeGreaterThanOrEqual(55);
    expect(new Set(EVENT_DEFS.map((d) => d.id)).size).toBe(EVENT_DEFS.length);
    for (const id of NEW_EVENTS) expect(EVENT_BY_ID[id], id).toBeDefined();
  });

  it('a quantidade de eventos por temporada é exatamente a sorteada por rollEventCount', () => {
    const careers = [setup(), setup({ age: 35, caps: 30 }), setup({ age: 17, last: null }), setup({ parentClubId: 'real-madrid' }), setup({ arrived: true, reputation: 80 })];
    for (const c of careers) {
      for (let seed = 1; seed <= 150; seed++) {
        expect(rollSeasonEvents(c, new Rng(seed)).length).toBe(rollEventCount(c, new Rng(seed)));
      }
    }
  });

  it('todo evento novo é sorteável no contexto certo', () => {
    for (const id of NEW_EVENTS) {
      const c = setup(CONTEXTS[id] ?? {});
      expect(EVENT_BY_ID[id].weight(eventContext(c)), id).toBeGreaterThan(0);
      let hits = 0;
      for (let seed = 1; seed <= 400 && hits === 0; seed++) if (rollSeasonEvents(c, new Rng(seed)).some((e) => e.defId === id)) hits++;
      expect(hits, id).toBeGreaterThan(0);
    }
  });

  it('eventos respeitam idade, seleção, clube e momento da carreira', () => {
    expect(weight('youth_tournament', { age: 27 })).toBe(0);
    expect(weight('retirement_whispers', { age: 17 })).toBe(0);
    expect(weight('veteran_leader', { age: 22 })).toBe(0);
    expect(weight('national_snub', { caps: 0, last: { national: { ...SAMPLE.national, calledUp: false } } })).toBe(0);
    expect(weight('national_veteran', { age: 32, caps: 0 })).toBe(0);
    expect(weight('loan_spell', {})).toBe(0);
    expect(weight('adaptation', {})).toBe(0);
    expect(weight('club_tribute', { age: 29, seasonsHere: 2 })).toBe(0);
    expect(weight('homeland_call', { age: 31, clubId: 'santos' })).toBe(0);
    expect(weight('goal_drought', { last: { apps: 30, goals: 20 } })).toBe(0);
    expect(weight('title_defense', { last: { trophies: [] } })).toBe(0);
    expect(weight('club_crisis', { last: { leaguePos: 2, leagueSize: 20 } })).toBe(0);
    // Primeira temporada: nada que dependa de temporada anterior.
    const rookie = eventContext(setup({ age: 17, last: null }));
    for (const id of ['marked_man', 'bounce_back', 'milestone_goals', 'fatigue_warning', 'fitness_peak', 'club_crisis', 'title_defense', 'national_snub']) {
      expect(EVENT_BY_ID[id].weight(rookie), id).toBe(0);
    }
    // Goleiro não recebe a seca de gols de atacante.
    const keeper = setup({ last: { apps: 30, goals: 0 } });
    keeper.position = 'GOL';
    expect(EVENT_BY_ID.goal_drought.weight(eventContext(keeper))).toBe(0);
  });

  it('eventos contraditórios nunca caem na mesma temporada', () => {
    const contexts = [setup({ last: { rating: 6.3 } }), setup({ age: 31 }), setup({ reputation: 70 }), setup({ age: 28, last: { rating: 7.6 } })];
    for (const c of contexts) {
      for (let seed = 1; seed <= 300; seed++) {
        const defs = rollSeasonEvents(c, new Rng(seed)).map((e) => EVENT_BY_ID[e.defId]);
        expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
        const tags = defs.flatMap((d) => d.conflicts ?? []);
        expect(new Set(tags).size, defs.map((d) => d.id).join(',')).toBe(tags.length);
      }
    }
  });

  it('as escolhas dos eventos novos funcionam e têm consequências moderadas', () => {
    for (const id of NEW_EVENTS) {
      const base = setup(CONTEXTS[id] ?? {});
      const ctx = eventContext(base);
      const params = EVENT_BY_ID[id].params?.(ctx, new Rng(1)) ?? {};
      const choices = EVENT_BY_ID[id].choices(ctx, params);
      expect(choices.length, id).toBeGreaterThanOrEqual(2);
      expect(EVENT_BY_ID[id].text(ctx, params).length).toBeGreaterThan(20);
      for (let i = 0; i < choices.length; i++) {
        for (let seed = 1; seed <= 6; seed++) {
          const c = structuredClone(base);
          const res = resolveEventChoice(c, { defId: id, params }, i, new Rng(seed));
          expect(res.resolved?.text.length, `${id}#${i}`).toBeGreaterThan(5);
          for (const k of Object.keys(c.attributes) as (keyof typeof c.attributes)[]) {
            expect(Math.abs((c.attributes[k] ?? 0) - (base.attributes[k] ?? 0))).toBeLessThanOrEqual(2);
            expect(Math.abs((c.potential[k] ?? 0) - (base.potential[k] ?? 0))).toBeLessThanOrEqual(3);
          }
          expect(c.weeklyWage / base.weeklyWage).toBeGreaterThanOrEqual(0.8);
          expect(c.weeklyWage / base.weeklyWage).toBeLessThanOrEqual(1.3);
          expect(Math.abs(c.reputation - base.reputation)).toBeLessThanOrEqual(5);
          expect(Math.abs(c.modifiers.startShare)).toBeLessThanOrEqual(0.15);
          expect(c.modifiers.preseasonInjuryGames).toBeLessThanOrEqual(3);
          expect(c.position).toBe(base.position);
          if (c.promisedClubId !== base.promisedClubId) {
            expect(getClub(c.promisedClubId), `${id}#${i}`).toBeDefined();
            expect(c.promisedClubId).not.toBe(c.clubId);
          }
        }
      }
    }
  });

  it('o clube do país natal é de fato do país do jogador', () => {
    const c = setup({ age: 31, clubId: 'real-madrid' });
    for (let seed = 1; seed <= 20; seed++) {
      const x = structuredClone(c);
      resolveEventChoice(x, { defId: 'homeland_call', params: {} }, 0, new Rng(seed));
      expect(getClub(x.promisedClubId)?.country).toBe(c.profile.nationality);
    }
  });

  it('carreiras completas passam pelos eventos novos e com menos repetição entre temporadas', () => {
    const seen = new Set<string>();
    let repeats = 0;
    let total = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const c = autoplayCareer(profile('ATA'), seed);
      expect(c.phase).toBe('retired');
      c.seasons.forEach((s, i) => {
        expect(s.events.length).toBeGreaterThanOrEqual(1);
        expect(s.events.length).toBeLessThanOrEqual(6);
        s.events.forEach((e) => seen.add(e));
        if (i > 0) {
          total += s.events.length;
          repeats += s.events.filter((e) => c.seasons[i - 1].events.includes(e)).length;
        }
      });
    }
    expect(NEW_EVENTS.filter((id) => seen.has(id)).length).toBeGreaterThan(15);
    expect(repeats / total).toBeLessThan(0.1);
  });
});

import { describe, expect, it } from 'vitest';
import { CAREER } from '../config/balance';
import { EVENT_DEFS } from '../data/events';
import type { PositionId } from '../types';
import { autoplayCareer } from './autoplay';
import { announceRetirement, chooseEventOption, continueAfterEvent, retireNow, startSeason } from './career';
import { eventContext, rollEventCount, rollSeasonEvents } from './events';
import { Rng } from './rng';
import { hubCareer, profile } from './testUtils';

describe('carreira completa', () => {
  it('vai do draft até a aposentadoria com legado calculado', () => {
    const positions: PositionId[] = ['ATA', 'MEI', 'ZAG', 'GOL', 'PE'];
    positions.forEach((pos, i) => {
      const c = autoplayCareer(profile(pos, 'ARG', 17), 500 + i);
      expect(c.phase).toBe('retired');
      expect(c.legacy).not.toBeNull();
      expect(c.legacy!.score).toBeGreaterThanOrEqual(0);
      expect(c.legacy!.score).toBeLessThanOrEqual(100);
      expect(c.seasons.length).toBeGreaterThan(5);
      expect(c.age).toBeLessThanOrEqual(CAREER.maxAge);
      // Idade avança uma vez por temporada.
      c.seasons.forEach((s, idx) => expect(s.age).toBe(17 + idx));
      expect(c.peakOvr).toBeGreaterThanOrEqual(Math.max(...c.seasons.map((s) => s.ovrEnd)));
    });
  });

  it('é reproduzível com a mesma seed e varia com seeds diferentes', () => {
    const a = autoplayCareer(profile('PD'), 1234);
    const b = autoplayCareer(profile('PD'), 1234);
    const c = autoplayCareer(profile('PD'), 4321);
    const strip = (x: typeof a) => ({ ...x, id: '', createdAt: 0, updatedAt: 0 });
    expect(strip(a).seasons).toEqual(strip(b).seasons);
    expect(a.legacy!.score).toBe(b.legacy!.score);
    expect(JSON.stringify(a.seasons)).not.toBe(JSON.stringify(c.seasons));
  });

  it('carreiras terminam com resultados variados', () => {
    const scores = Array.from({ length: 12 }, (_, i) => autoplayCareer(profile('MEI'), 900 + i * 31).legacy!.score);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(10);
  });

  it('anunciar a aposentadoria encerra a carreira ao fim da temporada', () => {
    const c = autoplayCareer(profile('ATA'), 77, { retireAge: 34 });
    expect(c.phase).toBe('retired');
    // Jogou a última temporada aos 34 e encerrou a carreira com 35.
    expect(c.seasons.at(-1)!.age).toBe(34);
    expect(c.age).toBe(35);
    expect(c.retirementAge).toBe(35);
  });

  it('não permite aposentar cedo demais', () => {
    const c = hubCareer('ATA', 1);
    expect(announceRetirement(c).retireAnnounced).toBe(false);
    expect(retireNow(c).phase).toBe('hub');
  });
});

describe('eventos', () => {
  it('toda definição tem escolhas e textos válidos quando elegível', () => {
    const c = hubCareer('MEI', 3);
    const ctx = eventContext(c);
    for (const def of EVENT_DEFS) {
      if (def.weight(ctx) <= 0) continue;
      const params = def.params ? def.params(ctx, new Rng(1)) : {};
      expect(def.title(params).length).toBeGreaterThan(3);
      expect(def.text(ctx, params).length).toBeGreaterThan(10);
      expect(def.choices(ctx, params).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('decisões têm consequência no estado da carreira', () => {
    let changed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let c = startSeason(hubCareer('ATA', seed));
      if (c.phase !== 'event') continue;
      const before = JSON.stringify({ m: c.modifiers, mo: c.morale, t: c.coachTrust, r: c.reputation, p: c.potential, a: c.attributes, pos: c.position, w: c.weeklyWage, pr: c.promisedClubId });
      c = chooseEventOption(c, 0);
      const ev = c.events[c.eventIndex];
      expect(ev.resolved?.text.length).toBeGreaterThan(5);
      const after = JSON.stringify({ m: c.modifiers, mo: c.morale, t: c.coachTrust, r: c.reputation, p: c.potential, a: c.attributes, pos: c.position, w: c.weeklyWage, pr: c.promisedClubId });
      if (before !== after) changed++;
    }
    expect(changed).toBeGreaterThan(10);
  });

  it('temporadas têm quantidades diferentes de eventos, dentro de limites', () => {
    const counts = new Map<number, number>();
    for (let seed = 1; seed <= 200; seed++) {
      const n = rollEventCount(hubCareer('ATA', 1), new Rng(seed));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThanOrEqual(5);
    // Temporadas cheias (5–6) existem, mas são minoria.
    expect((counts.get(5) ?? 0) + (counts.get(6) ?? 0)).toBeLessThan(80);
  });

  it('eventos sorteados não se repetem na mesma temporada e variam entre temporadas', () => {
    const c = hubCareer('MEI', 5);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const events = rollSeasonEvents(c, new Rng(seed));
      expect(new Set(events.map((e) => e.defId)).size).toBe(events.length);
      events.forEach((e) => seen.add(e.defId));
    }
    expect(seen.size).toBeGreaterThan(12);
  });

  it('a temporada só é simulada depois de todos os eventos serem resolvidos', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let c = startSeason(hubCareer('ATA', seed));
      const total = c.events.length;
      let resolved = 0;
      while (c.phase === 'event') {
        c = c.events[c.eventIndex].resolved ? continueAfterEvent(c) : chooseEventOption(c, 1);
        if (c.phase === 'event' && c.events[c.eventIndex]?.resolved) resolved++;
      }
      expect(c.phase).toBe('season-review');
      expect(c.seasons[0].events).toHaveLength(total);
      expect(c.seasons[0].eventNotes.length).toBe(total);
      expect(resolved).toBeGreaterThanOrEqual(total);
    }
  });
});

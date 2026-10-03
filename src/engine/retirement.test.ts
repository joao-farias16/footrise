import { describe, expect, it } from 'vitest';
import { CAREER } from '../config/balance';
import type { Career, PositionId } from '../types';
import { autoplayCareer } from './autoplay';
import { canRetire, chooseEventOption, continueAfterEvent, continueAfterReview, retireNow, startSeason, stayAtClub } from './career';
import { buildCareerSummary } from './careerSummary';
import { hubCareer, profile } from './testUtils';

/** Joga até o hub da idade pedida, sempre recusando a aposentadoria. */
function playUntilHubAge(c: Career, age: number): Career {
  for (let i = 0; i < 400 && !(c.phase === 'hub' && c.age === age) && c.phase !== 'retired'; i++) {
    if (c.phase === 'hub') c = startSeason(c);
    else if (c.phase === 'event') c = c.events[c.eventIndex].resolved ? continueAfterEvent(c) : chooseEventOption(c, 0);
    else if (c.phase === 'season-review') c = continueAfterReview(c);
    else if (c.phase === 'offers') c = stayAtClub(c);
  }
  return c;
}

describe('regras de aposentadoria', () => {
  it('a partir dos 34 o jogador pode escolher; antes não', () => {
    const c = playUntilHubAge(hubCareer('ATA', 4), 33);
    expect(c.phase).toBe('hub');
    expect(canRetire(c)).toBe(false);
    expect(retireNow(c).phase).toBe('hub');

    const at34 = playUntilHubAge(c, 34);
    expect(at34.age).toBe(34);
    expect(canRetire(at34)).toBe(true);
    const retired = retireNow(at34);
    expect(retired.phase).toBe('retired');
    expect(retired.retirementAge).toBe(34);
  });

  it('escolher continuar dos 34 aos 39 é permitido; aos 40 a aposentadoria é obrigatória', () => {
    let c = playUntilHubAge(hubCareer('MEI', 9), 34);
    for (let age = 34; age <= 39; age++) {
      c = playUntilHubAge(c, age);
      expect(c.phase).toBe('hub');
      expect(canRetire(c)).toBe(true);
    }
    // Recusa a aposentadoria aos 39 e joga a temporada: ao fim, chega aos 40 e para.
    c = playUntilHubAge(c, 40);
    expect(c.phase).toBe('retired');
    expect(c.age).toBe(CAREER.maxAge);
    expect(c.retirementAge).toBe(40);
    expect(c.seasons.at(-1)!.age).toBe(39);
    expect(c.forcedRetirementReason).toContain('40');
  });

  it('nenhuma carreira passa dos 40, para qualquer idade inicial e posição', () => {
    const cases: [PositionId, number][] = [['ATA', 16], ['GOL', 20], ['ZAG', 18], ['PD', 17]];
    cases.forEach(([pos, age], i) => {
      const c = autoplayCareer(profile(pos, 'BRA', age), 300 + i);
      expect(c.phase).toBe('retired');
      expect(c.retirementAge).toBe(40);
      expect(Math.max(...c.seasons.map((s) => s.age))).toBe(39);
      expect(c.seasons).toHaveLength(40 - age);
    });
  });
});

describe('resumo da carreira aposentada', () => {
  const c = autoplayCareer(profile('ATA', 'BRA', 17), 4242, { retireAge: 36 });
  const s = buildCareerSummary(c, 123);

  it('informações básicas vêm da carreira real', () => {
    expect(s.careerId).toBe(c.id);
    expect(s.savedAt).toBe(123);
    expect(s.player).toMatchObject({ name: c.profile.name, nationality: 'BRA', foot: c.profile.foot, preferredNumber: c.profile.number, startAge: 17 });
    expect(s.player.retirementAge).toBe(c.retirementAge);
    expect(s.player.careerYears).toBe(c.seasons.length);
    expect(s.player.firstSeason).toBe(c.seasons[0].season);
    expect(s.player.lastSeason).toBe(c.seasons.at(-1)!.season);
    expect(s.evolution.peakOvr).toBe(c.peakOvr);
    expect(s.evolution.peakValue).toBe(c.peakValue);
    expect(s.evolution.topAttributes).toHaveLength(3);
  });

  it('totais, clubes e temporadas fecham com os registros', () => {
    const sum = (f: (x: Career['seasons'][number]) => number) => c.seasons.reduce((t, x) => t + f(x), 0);
    expect(s.totals.apps).toBe(sum((x) => x.apps));
    expect(s.totals.goals).toBe(sum((x) => x.goals));
    expect(s.totals.assists).toBe(sum((x) => x.assists));
    expect(s.totals.minutes).toBe(sum((x) => x.minutes));
    expect(s.totals.yellow).toBe(sum((x) => x.yellow));
    // Nota média ponderada pelos jogos.
    const expected = sum((x) => x.rating * x.apps) / sum((x) => x.apps);
    expect(Math.abs(s.totals.avgRating - expected)).toBeLessThan(0.006);
    expect(s.clubs.reduce((t, x) => t + x.apps, 0)).toBe(s.totals.apps);
    expect(s.clubs.reduce((t, x) => t + x.goals, 0)).toBe(s.totals.goals);
    expect(s.clubs.reduce((t, x) => t + x.assists, 0)).toBe(s.totals.assists);
    expect(s.seasons).toHaveLength(c.seasons.length);
    s.seasons.forEach((row, i) => expect(row).toMatchObject({ season: c.seasons[i].season, age: c.seasons[i].age, ovr: c.seasons[i].ovrEnd, goals: c.seasons[i].goals }));
  });

  it('títulos são exatamente os conquistados, com clube/seleção e ano', () => {
    expect(s.trophies).toHaveLength(c.trophies.length);
    const clubTrophies = s.clubs.reduce((t, x) => t + x.trophies.length, 0);
    expect(clubTrophies).toBe(c.trophies.filter((t) => t.team !== 'Seleção').length);
    for (const t of s.trophies) expect(t.year).toBe(Number(t.season.slice(0, 4)) + 1);
  });

  it('salários: soma do que foi recebido em cada temporada (não salário final × anos)', () => {
    expect(s.earnings.total).toBe(c.totalEarnings);
    expect(s.earnings.total).toBe(c.seasons.reduce((t, x) => t + x.weeklyWage * 52, 0));
  });

  it('números de camisa de cada clube (e da seleção, se convocado)', () => {
    const clubIds = new Set(c.seasons.map((x) => x.clubId));
    for (const id of clubIds) expect(s.shirtNumbers.some((n) => n.kind === 'club' && n.clubId === id)).toBe(true);
    for (const x of c.seasons) expect(x.shirtNumber).toBeGreaterThan(0);
    if (c.national.caps > 0) expect(s.shirtNumbers.some((n) => n.kind === 'national')).toBe(true);
  });

  it('cabe com folga num documento do Firestore', () => {
    expect(JSON.stringify(s).length).toBeLessThan(200_000);
    expect(JSON.stringify(c).length).toBeLessThan(900_000);
  });
});

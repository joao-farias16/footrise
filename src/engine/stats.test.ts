import { describe, expect, it } from 'vitest';
import type { Attributes, PositionId, SeasonRecord } from '../types';
import { computeOverall } from './overall';
import { Rng } from './rng';
import { simulateSeason } from './season';
import { hubCareer } from './testUtils';

/** Simula várias temporadas de um jogador com atributos fixos em um clube. */
function seasons(position: PositionId, attrs: Attributes, clubId: string, n = 30): SeasonRecord[] {
  const c = structuredClone(hubCareer(position, 3));
  c.attributes = { ...attrs };
  c.potential = { ...attrs };
  c.position = position;
  c.clubId = clubId;
  c.age = 26;
  c.reputation = 60;
  c.continentalQualified = true;
  return Array.from({ length: n }, (_, s) => simulateSeason(c, new Rng(5000 + s)).record);
}

const avg = (rs: SeasonRecord[], f: (r: SeasonRecord) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
const per90 = (rs: SeasonRecord[], f: (r: SeasonRecord) => number) =>
  (rs.reduce((s, r) => s + f(r), 0) * 90) / Math.max(1, rs.reduce((s, r) => s + r.minutes, 0));

const ELITE_FINISHER: Attributes = { sho: 98, pac: 97, dri: 97, phy: 95, pas: 90, def: 50 };
const ELITE_PHYSICAL: Attributes = { sho: 86, pac: 99, dri: 97, phy: 99, pas: 92, def: 70 };
const AVERAGE_STRIKER: Attributes = { sho: 76, pac: 75, dri: 74, phy: 74, pas: 68, def: 40 };

describe('estatísticas por nível e posição', () => {
  const elite = seasons('ATA', ELITE_FINISHER, 'manchester-city');
  const physical = seasons('ATA', ELITE_PHYSICAL, 'manchester-city');
  const average = seasons('ATA', AVERAGE_STRIKER, 'internacional');

  it('centroavante 94+ com finalização 98 produz como elite', () => {
    expect(computeOverall(ELITE_FINISHER, 'ATA')).toBeGreaterThanOrEqual(94);
    expect(avg(elite, (r) => r.goals)).toBeGreaterThan(27);
    expect(avg(elite, (r) => r.goals)).toBeLessThan(42);
    // Titular saudável com muitos minutos pode ter um ano abaixo, mas nunca números de jogador comum.
    for (const r of elite.filter((x) => x.minutes >= 3400)) expect(r.goals).toBeGreaterThanOrEqual(15);
    // Há variação de uma temporada para outra.
    expect(new Set(elite.map((r) => r.goals)).size).toBeGreaterThan(8);
    // Mais gols que jogos é uma temporada histórica: possível, mas não o padrão.
    const historic = seasons('ATA', ELITE_FINISHER, 'manchester-city', 200).filter((r) => r.goals > r.apps).length;
    expect(historic).toBeGreaterThan(0);
    expect(historic).toBeLessThan(200 * 0.2);
  });

  it('finalização pesa: o finalizador marca mais que um atacante físico de overall parecido', () => {
    expect(Math.abs(computeOverall(ELITE_PHYSICAL, 'ATA') - computeOverall(ELITE_FINISHER, 'ATA'))).toBeLessThanOrEqual(2);
    expect(avg(elite, (r) => r.goals)).toBeGreaterThan(avg(physical, (r) => r.goals) * 1.15);
  });

  it('existe diferença clara entre centroavante mediano e craque', () => {
    expect(avg(average, (r) => r.goals)).toBeGreaterThan(5);
    expect(avg(average, (r) => r.goals)).toBeLessThan(17);
    expect(per90(elite, (r) => r.goals)).toBeGreaterThan(per90(average, (r) => r.goals) * 2.5);
  });

  it('minutos importam: reserva em clube gigante produz pouco e de forma proporcional', () => {
    const bench = seasons('ATA', AVERAGE_STRIKER, 'manchester-city', 15);
    for (const r of bench) {
      expect(r.starts).toBeLessThan(12);
      expect(r.goals).toBeLessThanOrEqual(Math.max(3, (r.minutes / 90) * 1.2));
    }
    expect(avg(bench, (r) => r.minutes)).toBeLessThan(avg(average, (r) => r.minutes) / 2);
  });

  it('ponta mistura gols e assistências; meia cria mais do que finaliza', () => {
    const winger = seasons('PD', { pac: 96, dri: 96, pas: 88, sho: 88, phy: 75, def: 45 }, 'liverpool');
    const ratio = avg(winger, (r) => r.assists) / avg(winger, (r) => r.goals);
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.8);
    const mid = seasons('MEI', { pas: 97, dri: 93, sho: 86, pac: 80, def: 70, phy: 75 }, 'barcelona');
    expect(avg(mid, (r) => r.assists)).toBeGreaterThan(avg(mid, (r) => r.goals));
    expect(per90(mid, (r) => r.detail!.keyPasses)).toBeGreaterThan(per90(elite, (r) => r.detail!.keyPasses));
  });

  it('zagueiro defende muito e marca pouco; goleiro tem estatísticas próprias', () => {
    const cb = seasons('ZAG', { def: 93, phy: 91, pac: 82, pas: 78, dri: 65, sho: 50 }, 'real-madrid');
    expect(avg(cb, (r) => r.goals)).toBeLessThan(5);
    expect(Math.max(...cb.map((r) => r.goals))).toBeLessThan(10);
    expect(per90(cb, (r) => r.detail!.clearances)).toBeGreaterThan(per90(elite, (r) => r.detail!.clearances) * 3);
    expect(per90(cb, (r) => r.detail!.interceptions)).toBeGreaterThan(per90(elite, (r) => r.detail!.interceptions) * 3);

    const gk = seasons('GOL', { div: 90, han: 88, ref: 92, gkp: 90, kic: 82, phy: 80 }, 'bayern-munchen');
    expect(avg(gk, (r) => r.goals)).toBe(0);
    expect(avg(gk, (r) => r.detail!.saves)).toBeGreaterThan(30);
    expect(avg(gk, (r) => r.starts)).toBeGreaterThan(25);
    expect(avg(gk, (r) => r.cleanSheets)).toBeGreaterThan(5);
  });

  it('volante desarma mais que meia e atacante', () => {
    const dm = seasons('VOL', { def: 88, pas: 86, phy: 86, dri: 78, pac: 72, sho: 70 }, 'arsenal', 15);
    expect(per90(dm, (r) => r.detail!.tackles)).toBeGreaterThan(per90(elite, (r) => r.detail!.tackles) * 3);
  });

  it('as estatísticas fecham entre si', () => {
    for (const r of [...elite, ...average]) {
      expect(r.starts).toBeLessThanOrEqual(r.apps);
      expect(r.minutes).toBeLessThanOrEqual(r.apps * 90);
      expect(r.detail!.shots).toBeGreaterThanOrEqual(r.goals);
      expect(r.detail!.keyPasses).toBeGreaterThanOrEqual(r.assists);
      expect(r.goals).toBeGreaterThanOrEqual(r.leagueGoals);
    }
  });
});

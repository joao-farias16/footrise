import { describe, expect, it } from 'vitest';
import { OUTFIELD_KEYS } from '../config/positions';
import { sanitizeCareer } from '../state/storage';
import type { Career } from '../types';
import { autoplayCareer } from './autoplay';
import { buildCareerSummary, careerPeakOvr, sanitizeSummary } from './careerSummary';
import { computeOverall } from './overall';
import { profile } from './testUtils';

const CURVE = [72, 81, 90, 96, 94, 88, 80, 66];

/** Carreira encerrada cujo OVR seguiu a curva 72 → 81 → 90 → 96 → 94 → 88 → 80 → 66. */
function curveCareer(): Career {
  const base = autoplayCareer(profile('ATA'), 4242, { retireAge: 34 });
  const c = structuredClone(base);
  const template = c.seasons[0];
  c.seasons = CURVE.map((ovr, i) => ({ ...structuredClone(template), season: `${2026 + i}/${27 + i}`, ovrStart: i === 0 ? 70 : CURVE[i - 1], ovrEnd: ovr }));
  for (const k of OUTFIELD_KEYS) c.attributes[k] = 66;
  c.peakOvr = 96;
  return c;
}

describe('pico de OVR x OVR final', () => {
  it('o pico é o maior OVR da carreira e o final é o da aposentadoria', () => {
    const c = curveCareer();
    const s = buildCareerSummary(c);
    expect(s.evolution.peakOvr).toBe(96);
    expect(s.evolution.peakOvrSeason).toBe('2029/30');
    expect(s.evolution.finalOvr).toBe(66);
    expect(s.evolution.finalOvr).toBe(computeOverall(c.attributes, c.position));
    expect(Object.values(s.evolution.finalAttributes).every((v) => v === 66)).toBe(true);
  });

  it('carreiras antigas sem pico registrado reconstroem o pico pelas temporadas', () => {
    const c = curveCareer();
    c.peakOvr = 0;
    expect(careerPeakOvr(c)).toBe(96);
    expect(buildCareerSummary(c).evolution.peakOvr).toBe(96);
    const loaded = sanitizeCareer({ ...structuredClone(c), peakOvr: undefined });
    expect(loaded?.peakOvr).toBe(96);
  });

  it('resumos salvos com pico ausente ou defasado são corrigidos sem perder dados', () => {
    const s = buildCareerSummary(curveCareer());
    const stale = { ...structuredClone(s), evolution: { ...s.evolution, peakOvr: 81, peakOvrSeason: '2027/28' } };
    const fixed = sanitizeSummary(stale)!;
    expect(fixed.evolution.peakOvr).toBe(96);
    expect(fixed.evolution.peakOvrSeason).toBe('2029/30');
    expect(fixed.evolution.finalOvr).toBe(66);

    const { peakOvr: _p, finalOvr: _f, ...noOvr } = s.evolution;
    const old = sanitizeSummary({ ...structuredClone(s), evolution: noOvr })!;
    expect(old.evolution.peakOvr).toBe(96);
    expect(old.evolution.finalOvr).toBe(66);
    expect(old.seasons).toHaveLength(CURVE.length);

    expect(sanitizeSummary(s)!.evolution).toEqual(s.evolution);
  });
});

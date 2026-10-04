import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OUTFIELD_KEYS } from '../config/positions';
import { autoplayCareer } from '../engine/autoplay';
import { buildCareerSummary } from '../engine/careerSummary';
import { profile } from '../engine/testUtils';
import { GameProvider } from '../state/GameContext';
import { loadCareerHistory, memoryStore, saveCareerSummary, type KeyValueStore } from '../state/storage';
import type { CareerSummary } from '../types';
import { HistoryScreen } from './screens/HistoryScreen';
import { LegacyScreen } from './screens/LegacyScreen';

const CURVE = [78, 84, 91, 89, 82, 66];

/** Resumo salvo cujo OVR seguiu 78 → 84 → 91 → 89 → 82 → 66, com nota de legado diferente do pico. */
function savedSummary(): { store: KeyValueStore; s: CareerSummary } {
  const c = structuredClone(autoplayCareer(profile('ATA'), 4242, { retireAge: 34 }));
  const template = c.seasons[0];
  c.seasons = CURVE.map((ovr, i) => ({ ...structuredClone(template), season: `${2026 + i}/${27 + i}`, ovrStart: i === 0 ? 70 : CURVE[i - 1], ovrEnd: ovr }));
  for (const k of OUTFIELD_KEYS) c.attributes[k] = 66;
  c.peakOvr = 91;
  const built = buildCareerSummary(c);
  built.legacy = { ...built.legacy, score: 37 };
  const store = memoryStore();
  saveCareerSummary(store, built);
  return { store, s: loadCareerHistory(store)[0] };
}

const render = (store: KeyValueStore, el: Parameters<typeof createElement>[0], props: object = {}) =>
  renderToStaticMarkup(createElement(GameProvider, { store, cloud: null, children: createElement(el, props) }));

describe('exibição do OVR máximo', () => {
  it('"Minhas carreiras" e o círculo do resumo mostram o mesmo pico, não a nota de legado', () => {
    const { store, s } = savedSummary();
    expect(s.evolution.peakOvr).toBe(91);
    expect(s.evolution.finalOvr).toBe(66);

    const list = render(store, HistoryScreen);
    expect(list).toMatch(/<div class="history-score"[^>]*><b>91<\/b>/);
    expect(list).not.toMatch(/<div class="history-score"[^>]*><b>37<\/b>/);

    const detail = render(store, LegacyScreen, { summary: s });
    expect(detail).toMatch(/<div class="eyebrow">OVR máximo<\/div><div class="legacy-score">91<\/div>/);
    expect(detail).not.toMatch(/<div class="eyebrow">Legado<\/div>/);
    // A nota de legado continua no detalhamento ("Como o legado foi calculado") e na categoria.
    expect(detail).toContain('Como o legado foi calculado');
    expect(detail).toContain(`class="legacy-tier">${s.legacy.tier}<`);
  });

  it('pico igual ao final aparece igual nas duas telas', () => {
    const { s } = savedSummary();
    const flat = { ...structuredClone(s), careerId: 'flat', evolution: { ...s.evolution, peakOvr: 66, finalOvr: 66 } };
    flat.seasons = flat.seasons.map((x) => ({ ...x, ovrStart: 66, ovr: 66 }));
    const only = memoryStore();
    saveCareerSummary(only, flat);
    const loaded = loadCareerHistory(only)[0];
    expect(loaded.evolution.peakOvr).toBe(66);
    expect(render(only, HistoryScreen)).toMatch(/<div class="history-score"[^>]*><b>66<\/b>/);
    expect(render(only, LegacyScreen, { summary: loaded })).toMatch(/<div class="legacy-score">66<\/div>/);
  });
});

import { EVENTS } from '../config/balance';
import { attrKeysFor } from '../config/positions';
import { EVENT_BY_ID, EVENT_DEFS, type EventContext, type EventDef, type EventEffects } from '../data/events';
import { getClub, CLUBS } from '../data/clubs';
import type { AttrKey, Career, EventInstance, SeasonModifiers } from '../types';
import { expectedStartShare } from './market';
import { computeOverall } from './overall';
import { clamp, type Rng } from './rng';

export function defaultModifiers(): SeasonModifiers {
  return { startShare: 0, form: 0, injuryRisk: 1, goalBonus: 0, callup: 0, preseasonInjuryGames: 0 };
}

export function eventContext(career: Career): EventContext {
  const club = getClub(career.clubId) ?? CLUBS[0];
  const ovr = computeOverall(career.attributes, career.position);
  const last = career.seasons[career.seasons.length - 1];
  return {
    career,
    ovr,
    club,
    startShare: expectedStartShare(ovr, club.strength, career.coachTrust, career.position),
    lastRating: last && last.apps > 0 ? last.rating : null,
  };
}

/**
 * Quantos eventos a temporada terá. A base é sorteada de uma distribuição controlada
 * (1 a 6, mais comum 2–4) e o contexto empurra um pouco: temporadas de Copa,
 * jogador famoso ou carreira em momento de virada tendem a ser mais movimentadas.
 */
export function rollEventCount(career: Career, rng: Rng): number {
  const weights = EVENTS.countWeights.map((w, n) => ({ n, w }));
  let n = rng.weighted(weights, (x) => x.w).n;
  const busy =
    (career.reputation >= 60 ? 0.25 : 0) +
    (career.seasons.length === 0 ? 0.15 : 0) +
    ((career.year + 1) % 4 === 2 && career.national.caps > 0 ? 0.25 : 0);
  if (rng.chance(busy)) n++;
  return clamp(n, EVENTS.minEvents, EVENTS.maxEvents);
}

/**
 * Sorteia os eventos da temporada. Eventos marcados como prioritários entram primeiro
 * (com chance alta, não garantida); depois o sorteio evita repetir eventos recentes e
 * acumular muitos da mesma categoria.
 */
export function rollSeasonEvents(career: Career, rng: Rng): EventInstance[] {
  const ctx = eventContext(career);
  const recent = new Set(career.seasons.slice(-2).flatMap((s) => s.events));
  const eligible = EVENT_DEFS.filter((d) => d.weight(ctx) > 0);
  const count = Math.min(rollEventCount(career, rng), eligible.length);
  const chosen: EventInstance[] = [];
  const categories = new Map<string, number>();
  const pool = [...eligible];
  const take = (def: EventDef) => {
    pool.splice(pool.indexOf(def), 1);
    // Situações contraditórias (ex.: lesão e pré-temporada arrasadora) não dividem a mesma temporada.
    if (def.conflicts?.length) {
      for (let i = pool.length - 1; i >= 0; i--) if (pool[i].conflicts?.some((t) => def.conflicts!.includes(t))) pool.splice(i, 1);
    }
    categories.set(def.category, (categories.get(def.category) ?? 0) + 1);
    chosen.push({ defId: def.id, params: def.params ? def.params(ctx, rng) : {} });
  };

  // Acontecimentos importantes da carreira têm prioridade.
  const priority = pool.filter((d) => (d.priority?.(ctx) ?? 0) > 0 && !recent.has(d.id));
  for (const def of rng.shuffle(priority)) {
    if (chosen.length >= count) break;
    if (pool.includes(def) && rng.chance(def.priority!(ctx))) take(def);
  }

  while (chosen.length < count && pool.length > 0) {
    const def = rng.weighted(pool, (d) => {
      const sameCat = categories.get(d.category) ?? 0;
      return d.weight(ctx) * (recent.has(d.id) ? EVENTS.recentPenalty : 1) * EVENTS.sameCategoryPenalty ** sameCat;
    });
    take(def);
  }
  return rng.shuffle(chosen);
}

export interface EventView {
  id: string;
  category: string;
  icon: string;
  title: string;
  text: string;
  choices: { label: string; hint: string }[];
}

export function viewEvent(career: Career, instance: EventInstance): EventView | null {
  const def = EVENT_BY_ID[instance.defId];
  if (!def) return null;
  const ctx = eventContext(career);
  return {
    id: def.id,
    category: def.category,
    icon: def.icon,
    title: def.title(instance.params),
    text: def.text(ctx, instance.params),
    choices: def.choices(ctx, instance.params).map((c) => ({ label: c.label, hint: c.hint })),
  };
}

/** Aplica efeitos de evento à carreira (muta o objeto recebido). */
export function applyEffects(career: Career, e: EventEffects): string[] {
  const tags: string[] = [];
  const m = career.modifiers;
  if (e.morale) career.morale = clamp(career.morale + e.morale, 0, 100);
  if (e.coachTrust) career.coachTrust = clamp(career.coachTrust + e.coachTrust, 0, 100);
  if (e.reputation) career.reputation = clamp(career.reputation + e.reputation, 0, 100);
  if (e.startShare) m.startShare += e.startShare;
  if (e.form) m.form += e.form;
  if (e.injuryRisk) m.injuryRisk *= e.injuryRisk;
  if (e.goalBonus) m.goalBonus += e.goalBonus;
  if (e.callup) m.callup += e.callup;
  if (e.preseasonInjuryGames) m.preseasonInjuryGames += e.preseasonInjuryGames;
  const keys = attrKeysFor(career.position);
  if (e.potential) {
    for (const [k, d] of Object.entries(e.potential)) {
      const key = k as AttrKey;
      if (!keys.includes(key) || d === undefined) continue;
      career.potential[key] = clamp((career.potential[key] ?? 50) + d, 20, 99);
      tags.push('potential');
    }
  }
  if (e.attributes) {
    for (const [k, d] of Object.entries(e.attributes)) {
      const key = k as AttrKey;
      if (!keys.includes(key) || d === undefined) continue;
      career.attributes[key] = clamp((career.attributes[key] ?? 50) + d, 20, 99);
      tags.push(d > 0 ? 'attr-up' : 'attr-down');
    }
  }
  if (e.position && e.position !== career.position) {
    // Mudança só entre posições de linha (mesmo conjunto de atributos).
    if (career.position !== 'GOL' && e.position !== 'GOL') {
      career.position = e.position;
      tags.push('position');
    }
  }
  if (e.promisedClubId) {
    career.promisedClubId = e.promisedClubId;
    tags.push('interest');
  }
  if (e.wageMultiplier) {
    career.weeklyWage = Math.round(career.weeklyWage * e.wageMultiplier);
    tags.push('wage');
  }
  if (e.preseasonInjuryGames) tags.push('injury');
  return tags;
}

export function resolveEventChoice(career: Career, instance: EventInstance, choiceIndex: number, rng: Rng): EventInstance {
  const def = EVENT_BY_ID[instance.defId];
  if (!def || instance.resolved) return instance;
  const ctx = eventContext(career);
  const choices = def.choices(ctx, instance.params);
  const choice = choices[clamp(choiceIndex, 0, choices.length - 1)];
  const outcome = choice.resolve(ctx, instance.params, rng);
  const tags = applyEffects(career, outcome.effects);
  return { ...instance, resolved: { choiceIndex, text: outcome.text, tags } };
}

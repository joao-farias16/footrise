import { DRAFT } from '../config/balance';
import { attrKeysFor, POSITIONS } from '../config/positions';
import { LEGENDS, LEGEND_BY_ID } from '../data/legends';
import type { AttrKey, Attributes, DraftOption, DraftRound, DraftSlot, DraftState, Legend, PositionId } from '../types';
import { computeOverallExact } from './overall';
import type { Rng } from './rng';

/** Valor que uma lenda fornece para um atributo (ou undefined se não fornece). */
export function legendValue(legend: Legend, attr: AttrKey): number | undefined {
  const direct = legend.stats[attr];
  if (direct !== undefined) return direct;
  // Goleiros podem herdar o jogo com os pés do passe de jogadores de linha.
  if (attr === 'kic' && legend.stats.pas !== undefined) return legend.stats.pas - DRAFT.kickFromPassPenalty;
  return undefined;
}

export function offerableAttrs(legend: Legend, position: PositionId): AttrKey[] {
  return attrKeysFor(position).filter((k) => legendValue(legend, k) !== undefined);
}

/** Atributos da posição que ainda não foram escolhidos (os escolhidos ficam bloqueados). */
export function emptyAttrs(draft: Pick<DraftState, 'slots'>, position: PositionId): AttrKey[] {
  return attrKeysFor(position).filter((k) => !draft.slots[k]);
}

/** Atributos que a lenda pode oferecer nesta rodada: só os ainda vazios. */
function openAttrs(legend: Legend, position: PositionId, draft: DraftState): AttrKey[] {
  return offerableAttrs(legend, position).filter((k) => !draft.slots[k]);
}

export function legendPool(position: PositionId): Legend[] {
  // Jogadores de linha só recebem atributos de jogadores de linha.
  return LEGENDS.filter(
    (l) => (position === 'GOL' || l.position !== 'GOL') && offerableAttrs(l, position).length >= DRAFT.optionsPerLegend,
  );
}

/** Converte os slots do draft em atributos (slots vazios ficam ausentes). */
export function slotsToAttributes(slots: Partial<Record<AttrKey, DraftSlot>>): Attributes {
  const attrs: Attributes = {};
  for (const [k, slot] of Object.entries(slots)) {
    if (slot) attrs[k as AttrKey] = slot.value;
  }
  return attrs;
}

/** Potencial projetado considerando slots vazios com o valor base. */
export function projectedOverall(slots: Partial<Record<AttrKey, DraftSlot>>, position: PositionId): number {
  return computeOverallExact(slotsToAttributes(slots), position, DRAFT.emptySlotBaseline);
}

/** Quanto o potencial (OVR) muda ao escolher uma opção. */
export function optionGain(
  slots: Partial<Record<AttrKey, DraftSlot>>,
  position: PositionId,
  option: Pick<DraftOption, 'attr' | 'value'>,
): number {
  const before = projectedOverall(slots, position);
  const after = projectedOverall({ ...slots, [option.attr]: { value: option.value, source: 'x' } }, position);
  return after - before;
}

function pickOfferedAttrs(legend: Legend, position: PositionId, draft: DraftState, rng: Rng): AttrKey[] {
  const available = openAttrs(legend, position, draft);
  if (available.length === 0) return [];
  const weights = POSITIONS[position].weights;
  const relevance = (k: AttrKey) => (draft.slots[k] ? 1 : 1.4) * (1 + (weights[k] ?? 0) * 2);
  // Às vezes a lenda oferece seu atributo assinatura (o maior); nem sempre.
  const signature = available.reduce((best, k) =>
    (legendValue(legend, k) ?? 0) > (legendValue(legend, best) ?? 0) ? k : best,
  );
  const first = rng.chance(DRAFT.signatureChance) ? signature : rng.weighted(available, relevance);
  const picked = [first];
  while (picked.length < DRAFT.optionsPerLegend && picked.length < available.length) {
    picked.push(rng.weighted(available.filter((k) => !picked.includes(k)), relevance));
  }
  return picked;
}

function scoreRound(draft: DraftState, position: PositionId, options: DraftOption[], rng: Rng): number {
  const gains = options.map((o) => optionGain(draft.slots, position, o)).sort((a, b) => b - a);
  let score = rng.next() * 0.5;
  // Evita rodadas em que nada vale a pena.
  if (gains[0] < DRAFT.minBestGain) score -= 10 + (DRAFT.minBestGain - gains[0]);
  // Evita uma escolha óbvia muito acima das demais.
  const gap = gains[0] - (gains[1] ?? 0);
  if (gap > DRAFT.maxGainGap) score -= (gap - DRAFT.maxGainGap) * 2;
  // Recompensa variedade de atributos (dilemas entre caminhos diferentes).
  score += new Set(options.map((o) => o.attr)).size * 0.4;
  return score;
}

export function generateRound(draft: DraftState, position: PositionId, rng: Rng): DraftRound {
  const used = new Set(draft.usedLegends);
  // Só entram lendas que oferecem algum atributo ainda vazio.
  const eligible = legendPool(position).filter((l) => openAttrs(l, position, draft).length > 0);
  const fresh = eligible.filter((l) => !used.has(l.id));
  // Se faltarem lendas inéditas para o atributo restante, repete lendas em vez de oferecer atributo bloqueado.
  const pool = fresh.length >= DRAFT.legendsPerRound ? fresh : eligible;
  const isKeeper = position === 'GOL';
  let best: { round: DraftRound; score: number } | null = null;

  for (let i = 0; i < DRAFT.candidateRounds; i++) {
    const chosen: Legend[] = [];
    const candidates = [...pool];
    while (chosen.length < DRAFT.legendsPerRound && candidates.length > 0) {
      const l = rng.weighted(candidates, (c) => (isKeeper && c.position === 'GOL' ? 2 : 1));
      chosen.push(l);
      candidates.splice(candidates.indexOf(l), 1);
    }
    const options: DraftOption[] = chosen.flatMap((l) =>
      pickOfferedAttrs(l, position, draft, rng).map((attr) => ({
        legendId: l.id,
        attr,
        value: legendValue(l, attr) ?? 0,
      })),
    );
    const round: DraftRound = { legendIds: chosen.map((l) => l.id), options };
    const score = scoreRound(draft, position, options, rng);
    if (!best || score > best.score) best = { round, score };
  }
  return best!.round;
}

export function createDraft(position: PositionId, rng: Rng): DraftState {
  const draft: DraftState = {
    round: 1,
    totalRounds: attrKeysFor(position).length,
    current: null,
    slots: {},
    picks: [],
    usedLegends: [],
    rerollUsed: false,
  };
  draft.current = generateRound(draft, position, rng);
  return draft;
}

export function applyDraftPick(draft: DraftState, position: PositionId, optionIndex: number, rng: Rng): DraftState {
  const round = draft.current;
  if (!round) return draft;
  const option = round.options[optionIndex];
  if (!option) return draft;
  // Atributo já escolhido fica bloqueado pelo resto da carreira.
  if (draft.slots[option.attr]) return draft;

  const next: DraftState = {
    ...draft,
    slots: { ...draft.slots, [option.attr]: { value: option.value, source: option.legendId } },
    picks: [
      ...draft.picks,
      { round: draft.round, legendId: option.legendId, attr: option.attr, value: option.value, replaced: draft.slots[option.attr] },
    ],
    usedLegends: [...draft.usedLegends, ...round.legendIds],
    round: draft.round + 1,
    current: null,
  };
  if (!isDraftComplete(next)) next.current = generateRound(next, position, rng);
  return next;
}

/** Reroll: sorteia de novo as opções da rodada atual (uma vez por carreira). */
export function rerollDraftRound(draft: DraftState, position: PositionId, rng: Rng): DraftState {
  if (draft.rerollUsed || !draft.current) return draft;
  // Evita repetir as lendas da rodada atual, se ainda houver lendas suficientes.
  const excluded = [...draft.usedLegends, ...draft.current.legendIds];
  const remaining = legendPool(position).filter((l) => !excluded.includes(l.id)).length;
  const base = remaining >= DRAFT.legendsPerRound ? { ...draft, usedLegends: excluded } : draft;
  return { ...draft, current: generateRound(base, position, rng), rerollUsed: true };
}

export function isDraftComplete(draft: DraftState): boolean {
  return draft.round > draft.totalRounds || Object.values(draft.slots).filter(Boolean).length >= draft.totalRounds;
}

/**
 * Corrige drafts salvos por versões antigas (8 rodadas, atributos repetíveis):
 * 1 rodada por atributo vazio e a rodada atual só com atributos vazios.
 * Retorna o mesmo objeto se o draft já estiver consistente.
 */
export function repairDraft(draft: DraftState, position: PositionId, rng: Rng): DraftState {
  const total = attrKeysFor(position).length;
  const filled = total - emptyAttrs(draft, position).length;
  const roundOk = draft.current !== null && draft.current.options.length > 0 && draft.current.options.every((o) => !draft.slots[o.attr]);
  if (draft.totalRounds === total && draft.round === filled + 1 && (filled >= total || roundOk)) return draft;
  const next: DraftState = { ...draft, totalRounds: total, round: filled + 1, current: null };
  if (!isDraftComplete(next)) next.current = roundOk ? draft.current : generateRound(next, position, rng);
  return next;
}

/** Fecha o draft: atributos não escolhidos vêm da academia. */
export function finalizeDraft(
  draft: DraftState,
  position: PositionId,
  rng: Rng,
): { potential: Attributes; sources: Partial<Record<AttrKey, string>> } {
  const potential: Attributes = {};
  const sources: Partial<Record<AttrKey, string>> = {};
  for (const key of attrKeysFor(position)) {
    const slot = draft.slots[key];
    if (slot) {
      potential[key] = slot.value;
      sources[key] = slot.source;
    } else {
      potential[key] = rng.int(DRAFT.academyMin, DRAFT.academyMax);
      sources[key] = 'academy';
    }
  }
  return { potential, sources };
}

export function legendName(id: string): string {
  if (id === 'academy') return 'Academia';
  return LEGEND_BY_ID[id]?.name ?? 'Desconhecido';
}

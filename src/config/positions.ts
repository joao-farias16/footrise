import type { AttrKey, PositionId } from '../types';

export interface AttrMeta {
  key: AttrKey;
  short: string;
  label: string;
}

export const ATTR_META: Record<AttrKey, AttrMeta> = {
  pac: { key: 'pac', short: 'VEL', label: 'Velocidade' },
  sho: { key: 'sho', short: 'FIN', label: 'Finalização' },
  pas: { key: 'pas', short: 'PAS', label: 'Passe' },
  dri: { key: 'dri', short: 'DRI', label: 'Drible' },
  def: { key: 'def', short: 'DEF', label: 'Defesa' },
  phy: { key: 'phy', short: 'FIS', label: 'Físico' },
  div: { key: 'div', short: 'ELA', label: 'Elasticidade' },
  han: { key: 'han', short: 'MAN', label: 'Manuseio' },
  ref: { key: 'ref', short: 'REF', label: 'Reflexos' },
  gkp: { key: 'gkp', short: 'POS', label: 'Posicionamento' },
  kic: { key: 'kic', short: 'PÉS', label: 'Jogo com os pés' },
};

export const OUTFIELD_KEYS: AttrKey[] = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
export const KEEPER_KEYS: AttrKey[] = ['div', 'han', 'ref', 'gkp', 'kic', 'phy'];

export type PositionGroup = 'gk' | 'def' | 'mid' | 'att';

/**
 * Perfil estatístico da posição. Usado pela simulação de partidas para transformar
 * atributos em produção coerente (gols, assistências, ações defensivas).
 */
export interface StatProfile {
  /** Fatia base dos gols do time marcados pelo jogador (com atributos 75 e nível igual ao do time). */
  goal: number;
  /** Fatia base dos gols do time com assistência do jogador. */
  assist: number;
  /** Atributos que levam o jogador a ter chances (atacar espaço, vencer marcadores, presença na área). */
  access: Partial<Record<AttrKey, number>>;
  /** Atributos que convertem a chance em gol. */
  finish: Partial<Record<AttrKey, number>>;
  /** Atributos de criação (passe decisivo, cruzamento, último passe). */
  create: Partial<Record<AttrKey, number>>;
  /** Médias por 90 minutos com atributos 75. */
  keyPasses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  /** Chance de jogar os 90 minutos quando começa como titular. */
  fullMatch: number;
}

export interface PositionDef {
  id: PositionId;
  label: string;
  group: PositionGroup;
  /** Pesos do overall. Devem somar 1. */
  weights: Partial<Record<AttrKey, number>>;
  /** Posições para as quais um treinador pode sugerir mudança. */
  neighbors: PositionId[];
  /** Participação base em gols/assistências do time (por 90 minutos). */
  goalShare: number;
  assistShare: number;
  /** Multiplicador de chance de cartão. */
  cardRisk: number;
  stats: StatProfile;
}

const FULLBACK_STATS: StatProfile = {
  goal: 0.025,
  assist: 0.085,
  access: { pac: 0.6, dri: 0.4 },
  finish: { sho: 1 },
  create: { pas: 0.5, pac: 0.3, dri: 0.2 },
  keyPasses: 0.9,
  tackles: 2.1,
  interceptions: 1.1,
  clearances: 1.6,
  fullMatch: 0.85,
};

const WINGER_STATS: StatProfile = {
  goal: 0.15,
  assist: 0.135,
  access: { pac: 0.45, dri: 0.45, phy: 0.1 },
  finish: { sho: 1 },
  create: { pas: 0.4, dri: 0.35, pac: 0.25 },
  keyPasses: 1.6,
  tackles: 0.8,
  interceptions: 0.35,
  clearances: 0.2,
  fullMatch: 0.62,
};

export const POSITIONS: Record<PositionId, PositionDef> = {
  GOL: {
    id: 'GOL',
    label: 'Goleiro',
    group: 'gk',
    weights: { ref: 0.24, div: 0.22, gkp: 0.22, han: 0.18, kic: 0.08, phy: 0.06 },
    neighbors: [],
    goalShare: 0,
    assistShare: 0.01,
    cardRisk: 0.3,
    stats: {
      goal: 0,
      assist: 0.006,
      access: {},
      finish: {},
      create: { kic: 1 },
      keyPasses: 0.05,
      tackles: 0,
      interceptions: 0.1,
      clearances: 0.6,
      fullMatch: 0.99,
    },
  },
  LD: {
    id: 'LD',
    label: 'Lateral Direito',
    group: 'def',
    weights: { def: 0.28, pac: 0.24, pas: 0.2, phy: 0.16, dri: 0.1, sho: 0.02 },
    neighbors: ['ZAG', 'PD', 'LE'],
    goalShare: 0.025,
    assistShare: 0.1,
    cardRisk: 1.2,
    stats: FULLBACK_STATS,
  },
  LE: {
    id: 'LE',
    label: 'Lateral Esquerdo',
    group: 'def',
    weights: { def: 0.28, pac: 0.24, pas: 0.2, phy: 0.16, dri: 0.1, sho: 0.02 },
    neighbors: ['ZAG', 'PE', 'LD'],
    goalShare: 0.025,
    assistShare: 0.1,
    cardRisk: 1.2,
    stats: FULLBACK_STATS,
  },
  ZAG: {
    id: 'ZAG',
    label: 'Zagueiro',
    group: 'def',
    weights: { def: 0.45, phy: 0.3, pac: 0.1, pas: 0.1, dri: 0.03, sho: 0.02 },
    neighbors: ['VOL', 'LD', 'LE'],
    goalShare: 0.035,
    assistShare: 0.025,
    cardRisk: 1.5,
    stats: {
      goal: 0.035,
      assist: 0.02,
      access: { phy: 1 },
      finish: { phy: 0.6, sho: 0.4 },
      create: { pas: 1 },
      keyPasses: 0.3,
      tackles: 1.7,
      interceptions: 1.5,
      clearances: 4,
      fullMatch: 0.93,
    },
  },
  VOL: {
    id: 'VOL',
    label: 'Volante',
    group: 'mid',
    weights: { def: 0.3, pas: 0.26, phy: 0.24, dri: 0.08, pac: 0.06, sho: 0.06 },
    neighbors: ['ZAG', 'MEI'],
    goalShare: 0.05,
    assistShare: 0.07,
    cardRisk: 1.5,
    stats: {
      goal: 0.045,
      assist: 0.075,
      access: { phy: 0.5, pas: 0.5 },
      finish: { sho: 1 },
      create: { pas: 0.8, dri: 0.2 },
      keyPasses: 1.0,
      tackles: 2.6,
      interceptions: 1.5,
      clearances: 1.3,
      fullMatch: 0.8,
    },
  },
  MEI: {
    id: 'MEI',
    label: 'Meia',
    group: 'mid',
    weights: { pas: 0.32, dri: 0.24, sho: 0.18, pac: 0.1, def: 0.08, phy: 0.08 },
    neighbors: ['VOL', 'PD', 'PE', 'ATA'],
    goalShare: 0.12,
    assistShare: 0.2,
    cardRisk: 0.9,
    stats: {
      goal: 0.1,
      assist: 0.16,
      access: { dri: 0.5, pas: 0.3, pac: 0.2 },
      finish: { sho: 1 },
      create: { pas: 0.65, dri: 0.3, pac: 0.05 },
      keyPasses: 2.0,
      tackles: 1.2,
      interceptions: 0.6,
      clearances: 0.4,
      fullMatch: 0.7,
    },
  },
  PD: {
    id: 'PD',
    label: 'Ponta Direita',
    group: 'att',
    weights: { pac: 0.26, dri: 0.26, pas: 0.18, sho: 0.18, phy: 0.08, def: 0.04 },
    neighbors: ['PE', 'ATA', 'MEI', 'LD'],
    goalShare: 0.18,
    assistShare: 0.18,
    cardRisk: 0.7,
    stats: WINGER_STATS,
  },
  PE: {
    id: 'PE',
    label: 'Ponta Esquerda',
    group: 'att',
    weights: { pac: 0.26, dri: 0.26, pas: 0.18, sho: 0.18, phy: 0.08, def: 0.04 },
    neighbors: ['PD', 'ATA', 'MEI', 'LE'],
    goalShare: 0.18,
    assistShare: 0.18,
    cardRisk: 0.7,
    stats: WINGER_STATS,
  },
  ATA: {
    id: 'ATA',
    label: 'Atacante',
    group: 'att',
    weights: { sho: 0.32, pac: 0.2, dri: 0.2, phy: 0.14, pas: 0.1, def: 0.04 },
    neighbors: ['PD', 'PE', 'MEI'],
    goalShare: 0.3,
    assistShare: 0.11,
    cardRisk: 0.8,
    stats: {
      goal: 0.23,
      assist: 0.085,
      access: { pac: 0.4, dri: 0.35, phy: 0.25 },
      finish: { sho: 1 },
      create: { pas: 0.5, dri: 0.35, pac: 0.15 },
      keyPasses: 1.0,
      tackles: 0.4,
      interceptions: 0.2,
      clearances: 0.4,
      fullMatch: 0.68,
    },
  },
};

export const POSITION_ORDER: PositionId[] = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MEI', 'PD', 'PE', 'ATA'];

export function attrKeysFor(position: PositionId): AttrKey[] {
  return position === 'GOL' ? KEEPER_KEYS : OUTFIELD_KEYS;
}

/** Atributos ordenados do mais para o menos importante para a posição. */
export function attrsByImportance(position: PositionId): AttrKey[] {
  const w = POSITIONS[position].weights;
  return [...attrKeysFor(position)].sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0));
}

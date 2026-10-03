import { CAREER } from '../config/balance';
import { POSITIONS } from '../config/positions';
import { CLUB_BY_ID, getClub, LEGACY_CLUB_RENAMES, resolveClubId } from '../data/clubs';
import { repairDraftCareer } from '../engine/career';
import { defaultModifiers } from '../engine/events';
import { buildCareerSummary, sanitizeSummary } from '../engine/careerSummary';
import type { Career, CareerPhase, CareerSummary } from '../types';

export const STORAGE_KEYS = {
  /** Carreira ativa (estado completo, para continuar exatamente de onde parou). */
  current: 'footrise:v1:current',
  /** Formato antigo do histórico (carreiras completas). Migrado para `careers`. */
  history: 'footrise:v1:history',
  /** Carreira recém-aposentada que ainda não foi salva no histórico. */
  retired: 'footrise:v1:retired',
  /** Histórico de carreiras encerradas (resumos completos). */
  careers: 'footrise:v2:careers',
  /** Estado da sincronização com a nuvem (último estado igual dos dois lados). */
  sync: 'footrise:v1:sync',
  /** Cópias de dados que falharam na validação (nunca apagamos um save). */
  quarantine: 'footrise:v1:quarantine',
  settings: 'footrise:v1:settings',
} as const;

/** Subconjunto da API Storage — permite usar memória nos testes. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export function browserStore(): KeyValueStore {
  try {
    const ls = window.localStorage;
    const probe = '__footrise_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    // Navegação privada ou storage bloqueado: o jogo funciona, só não salva entre sessões.
    return memoryStore();
  }
}

/**
 * Saves de versões com clubes fictícios: troca ids e nomes antigos pelos clubes reais
 * equivalentes (muta o objeto cru recebido do storage).
 */
function migrateClubs(c: Partial<Career>): void {
  const id = (v: unknown) => (typeof v === 'string' ? resolveClubId(v) : v);
  const name = (v: unknown) => (typeof v === 'string' ? LEGACY_CLUB_RENAMES[v] ?? v : v);
  c.clubId = id(c.clubId) as string | null;
  c.parentClubId = (id(c.parentClubId) as string | null) ?? null;
  c.promisedClubId = (id(c.promisedClubId) as string | null) ?? null;
  if (Array.isArray(c.offers)) for (const o of c.offers) if (isObject(o)) o.clubId = id(o.clubId) as string;
  if (Array.isArray(c.transfers)) {
    for (const t of c.transfers) {
      if (!isObject(t)) continue;
      t.fromClubId = id(t.fromClubId) as string;
      t.toClubId = id(t.toClubId) as string;
    }
  }
  if (Array.isArray(c.seasons)) {
    for (const s of c.seasons) {
      if (!isObject(s)) continue;
      s.clubId = id(s.clubId) as string;
      const club = CLUB_BY_ID[s.clubId];
      if (club) s.clubName = club.name;
      if (Array.isArray(s.trophies)) for (const t of s.trophies) if (isObject(t)) t.team = name(t.team) as string;
    }
  }
  if (Array.isArray(c.trophies)) for (const t of c.trophies) if (isObject(t)) t.team = name(t.team) as string;
}

const PHASES: CareerPhase[] = ['draft', 'card', 'club-choice', 'hub', 'event', 'season-review', 'offers', 'retired'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida e repara uma carreira vinda do storage. Retorna null se estiver
 * corrompida a ponto de não ser jogável.
 */
export function sanitizeCareer(raw: unknown): Career | null {
  if (!isObject(raw)) return null;
  const c = raw as Partial<Career>;
  migrateClubs(c);
  if (typeof c.id !== 'string' || !isObject(c.profile) || !isObject(c.draft)) return null;
  if (!c.phase || !PHASES.includes(c.phase)) return null;
  if (!c.position || !POSITIONS[c.position]) return null;
  if (typeof c.profile.name !== 'string' || !POSITIONS[c.profile.position]) return null;
  if (typeof c.age !== 'number' || typeof c.year !== 'number') return null;

  const beyondDraft = c.phase !== 'draft';
  if (beyondDraft && (!isObject(c.attributes) || !isObject(c.potential) || Object.keys(c.attributes).length === 0)) return null;
  if (c.phase === 'draft' && (!c.draft.current || !Array.isArray(c.draft.current.options))) return null;
  const needsClub = ['hub', 'event', 'season-review', 'offers'].includes(c.phase);
  if (needsClub && !getClub(c.clubId)) return null;

  const fixed: Career = {
    ...(c as Career),
    version: CAREER.saveVersion,
    rngState: typeof c.rngState === 'number' ? c.rngState : 12345,
    seasons: Array.isArray(c.seasons) ? c.seasons : [],
    trophies: Array.isArray(c.trophies) ? c.trophies : [],
    awards: Array.isArray(c.awards) ? c.awards : [],
    transfers: Array.isArray(c.transfers) ? c.transfers : [],
    offers: Array.isArray(c.offers) ? c.offers.filter((o) => getClub(o?.clubId)) : [],
    events: Array.isArray(c.events) ? c.events : [],
    eventIndex: typeof c.eventIndex === 'number' ? c.eventIndex : 0,
    modifiers: isObject(c.modifiers) ? { ...defaultModifiers(), ...c.modifiers } : defaultModifiers(),
    national: isObject(c.national)
      ? {
          caps: c.national.caps ?? 0,
          goals: c.national.goals ?? 0,
          debutSeason: c.national.debutSeason,
          tournaments: Array.isArray(c.national.tournaments) ? c.national.tournaments : [],
          callups: c.national.callups ?? (Array.isArray(c.seasons) ? c.seasons.filter((s) => s?.national?.calledUp).length : 0),
          starts: c.national.starts ?? 0,
          assists: c.national.assists ?? 0,
          qualifiers: Array.isArray(c.national.qualifiers) ? c.national.qualifiers : [],
        }
      : { caps: 0, goals: 0, tournaments: [], callups: 0, starts: 0, assists: 0, qualifiers: [] },
    sources: isObject(c.sources) ? c.sources : {},
    reputation: typeof c.reputation === 'number' ? c.reputation : 10,
    morale: typeof c.morale === 'number' ? c.morale : 60,
    coachTrust: typeof c.coachTrust === 'number' ? c.coachTrust : 50,
    parentClubId: c.parentClubId ?? null,
    promisedClubId: c.promisedClubId ?? null,
    forcedRetirementReason: c.forcedRetirementReason ?? null,
    retireAnnounced: !!c.retireAnnounced,
    peakOvr: c.peakOvr ?? 0,
    peakValue: c.peakValue ?? 0,
    totalEarnings: c.totalEarnings ?? 0,
    legacy: c.legacy ?? null,
    shirtNumbers: Array.isArray(c.shirtNumbers) ? c.shirtNumbers : [],
  };

  // Estados intermediários inconsistentes voltam para um ponto seguro.
  if (fixed.phase === 'offers' && fixed.offers.length === 0) fixed.phase = 'hub';
  if (fixed.phase === 'event' && fixed.eventIndex >= fixed.events.length) {
    fixed.phase = 'hub';
    fixed.events = [];
    fixed.eventIndex = 0;
  }
  if (fixed.phase === 'club-choice' && fixed.offers.length === 0) fixed.phase = 'card';
  if (fixed.phase === 'season-review' && fixed.seasons.length === 0) fixed.phase = 'hub';
  if (fixed.phase === 'retired' && !fixed.legacy) return null;
  return repairDraftCareer(fixed);
}

function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Guarda o texto cru de um save inválido em vez de apagá-lo. */
function quarantine(store: KeyValueStore, key: string): void {
  try {
    const raw = store.getItem(key);
    if (raw) store.setItem(`${STORAGE_KEYS.quarantine}:${key}`, raw);
    store.removeItem(key);
  } catch {
    /* ignora */
  }
}

function removeKey(store: KeyValueStore, key: string): boolean {
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Carreira ativa. Uma carreira aposentada salva no slot ativo (versões antigas) é movida para o slot de aposentada. */
/** Existe texto na chave, mas não é JSON válido. */
function isUnparseable(store: KeyValueStore, key: string): boolean {
  try {
    const raw = store.getItem(key);
    if (!raw) return false;
    JSON.parse(raw);
    return false;
  } catch {
    return true;
  }
}

export function loadCurrent(store: KeyValueStore): Career | null {
  const raw = readJson(store, STORAGE_KEYS.current);
  if (raw === null) {
    if (isUnparseable(store, STORAGE_KEYS.current)) quarantine(store, STORAGE_KEYS.current);
    return null;
  }
  const career = sanitizeCareer(raw);
  if (!career) {
    quarantine(store, STORAGE_KEYS.current);
    return null;
  }
  if (career.phase === 'retired') {
    if (!loadRetired(store) && saveRetired(store, career)) removeKey(store, STORAGE_KEYS.current);
    return null;
  }
  return career;
}

export function saveCurrent(store: KeyValueStore, career: Career | null): boolean {
  if (!career) return removeKey(store, STORAGE_KEYS.current);
  if (career.phase === 'retired') return false;
  return writeJson(store, STORAGE_KEYS.current, career);
}

/** Carreira aposentada aguardando "Salvar carreira" (sobrevive a recarregar a página). */
export function loadRetired(store: KeyValueStore): Career | null {
  const raw = readJson(store, STORAGE_KEYS.retired);
  if (raw === null) {
    if (isUnparseable(store, STORAGE_KEYS.retired)) quarantine(store, STORAGE_KEYS.retired);
    return null;
  }
  const career = sanitizeCareer(raw);
  if (!career || career.phase !== 'retired') {
    quarantine(store, STORAGE_KEYS.retired);
    return null;
  }
  return career;
}

export function saveRetired(store: KeyValueStore, career: Career | null): boolean {
  if (!career) return removeKey(store, STORAGE_KEYS.retired);
  if (career.phase !== 'retired') return false;
  return writeJson(store, STORAGE_KEYS.retired, career);
}

/**
 * A carreira ativa terminou: sai do slot ativo e vai para o slot de aposentada.
 * Se já havia outra aposentada não salva, ela é salva no histórico antes (nada se perde).
 */
export function moveToRetired(store: KeyValueStore, career: Career): boolean {
  const pending = loadRetired(store);
  if (pending && pending.id !== career.id) {
    if (!saveCareerSummary(store, buildCareerSummary(pending, pending.retiredAt ?? pending.updatedAt)).ok) return false;
  }
  if (!saveRetired(store, career)) return false;
  const current = readJson(store, STORAGE_KEYS.current);
  if (isObject(current) && current.id === career.id) removeKey(store, STORAGE_KEYS.current);
  return true;
}

function sortSummaries(list: CareerSummary[]): CareerSummary[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

/** Histórico de carreiras salvas (resumos). Converte o histórico antigo, se existir. */
export function loadCareerHistory(store: KeyValueStore): CareerSummary[] {
  const raw = readJson(store, STORAGE_KEYS.careers);
  const list = Array.isArray(raw) ? raw.map(sanitizeSummary).filter((x): x is CareerSummary => x !== null) : [];
  const legacy = readJson(store, STORAGE_KEYS.history);
  if (!Array.isArray(legacy) || legacy.length === 0) return sortSummaries(list);

  // Migração: carreiras completas do formato antigo viram resumos.
  const merged = [...list];
  for (const item of legacy) {
    const career = sanitizeCareer(item);
    if (!career || career.phase !== 'retired' || merged.some((s) => s.careerId === career.id)) continue;
    merged.push(buildCareerSummary(career, career.updatedAt));
  }
  // Só remove o formato antigo depois de gravar o novo com sucesso.
  if (writeJson(store, STORAGE_KEYS.careers, sortSummaries(merged))) quarantine(store, STORAGE_KEYS.history);
  return sortSummaries(merged);
}

export interface WriteResult {
  ok: boolean;
  history: CareerSummary[];
}

/** Salva (ou atualiza) um resumo no histórico local. Nunca descarta carreiras antigas para abrir espaço. */
export function saveCareerSummary(store: KeyValueStore, summary: CareerSummary): WriteResult {
  const current = loadCareerHistory(store);
  const next = sortSummaries([summary, ...current.filter((s) => s.careerId !== summary.careerId)]);
  const ok = writeJson(store, STORAGE_KEYS.careers, next);
  return { ok, history: ok ? next : current };
}

export function deleteCareerSummary(store: KeyValueStore, careerId: string): WriteResult {
  const current = loadCareerHistory(store);
  const next = current.filter((s) => s.careerId !== careerId);
  const ok = writeJson(store, STORAGE_KEYS.careers, next);
  return { ok, history: ok ? next : current };
}

// ---------- Sincronização ----------

/** Versão de uma carreira ativa: id + updatedAt identificam o estado exato. */
export interface ActiveVersion {
  careerId: string;
  updatedAt: number;
}

/**
 * O que estava igual no aparelho e na nuvem na última sincronização bem-sucedida.
 * `version: null` = a nuvem estava sem carreira ativa.
 */
export interface SyncMeta {
  uid: string;
  version: ActiveVersion | null;
}

export function loadSyncMeta(store: KeyValueStore): SyncMeta | null {
  const raw = readJson(store, STORAGE_KEYS.sync);
  if (!isObject(raw) || typeof raw.uid !== 'string') return null;
  const v = raw.version;
  const version =
    isObject(v) && typeof v.careerId === 'string' && typeof v.updatedAt === 'number' ? { careerId: v.careerId, updatedAt: v.updatedAt } : null;
  return { uid: raw.uid, version };
}

export function saveSyncMeta(store: KeyValueStore, meta: SyncMeta | null): boolean {
  if (!meta) return removeKey(store, STORAGE_KEYS.sync);
  return writeJson(store, STORAGE_KEYS.sync, meta);
}

export interface Settings {
  reduceMotion: boolean;
  defaultMode: 'analyst' | 'instinct';
}

export const DEFAULT_SETTINGS: Settings = { reduceMotion: false, defaultMode: 'analyst' };

export function loadSettings(store: KeyValueStore): Settings {
  const raw = readJson(store, STORAGE_KEYS.settings);
  return isObject(raw) ? { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) } : DEFAULT_SETTINGS;
}

export function saveSettings(store: KeyValueStore, s: Settings): void {
  writeJson(store, STORAGE_KEYS.settings, s);
}

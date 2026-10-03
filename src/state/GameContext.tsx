import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cloudAvailable as configuredCloud, firebaseSettings } from '../cloud/config';
import { CloudConflictError, CloudError, type CloudService, type CloudUser } from '../cloud/types';
import { createCareer } from '../engine/career';
import { buildCareerSummary, sanitizeSummary } from '../engine/careerSummary';
import type { Career, CareerSummary, DraftMode, PlayerProfile } from '../types';
import {
  browserStore,
  deleteCareerSummary,
  loadCareerHistory,
  loadCurrent,
  loadRetired,
  loadSettings,
  loadSyncMeta,
  moveToRetired,
  sanitizeCareer,
  saveCareerSummary,
  saveCurrent,
  saveRetired,
  saveSettings,
  saveSyncMeta,
  STORAGE_KEYS,
  type ActiveVersion,
  type KeyValueStore,
  type Settings,
} from './storage';
import { decideSync, sameVersion, versionOf, type ConflictReason } from './sync';

export type Screen = 'home' | 'create' | 'game' | 'history' | 'history-detail' | 'account';

export type SyncState = 'off' | 'checking' | 'saving' | 'synced' | 'error' | 'conflict';

export interface ConflictInfo {
  reason: ConflictReason;
  local: Career | null;
  cloud: Career | null;
  cloudVersion: ActiveVersion | null;
  /** O jogador escolheu "decidir depois": o aviso fica discreto e a sincronização pausada. */
  deferred: boolean;
}

export interface SyncStatus {
  state: SyncState;
  message?: string;
  conflict?: ConflictInfo;
  lastSyncedAt?: number;
}

/** Item do histórico: o resumo e onde ele está guardado. */
export interface HistoryItem {
  summary: CareerSummary;
  local: boolean;
  cloud: boolean;
}

interface GameState {
  screen: Screen;
  /** Carreira na tela (ativa, ou a recém-aposentada na tela de encerramento). */
  career: Career | null;
  /** Carreira ativa salva neste aparelho. */
  savedCareer: Career | null;
  /** Carreira aposentada que ainda não foi salva no histórico. */
  retiredCareer: Career | null;
  localHistory: CareerSummary[];
  cloudHistory: CareerSummary[];
  historyId: string | null;
  settings: Settings;
  user: CloudUser | null;
  authReady: boolean;
  sync: SyncStatus;
  localSave: { ok: boolean; at: number | null };
  notice: string | null;
}

export interface SaveCareerResult {
  ok: boolean;
  /** null = sem conta conectada; true/false = resultado do envio para a nuvem. */
  cloud: boolean | null;
  message: string;
}

interface GameApi extends GameState {
  history: HistoryItem[];
  cloudAvailable: boolean;
  goHome: () => void;
  goCreate: () => void;
  goHistory: () => void;
  goAccount: () => void;
  openHistoryCareer: (id: string) => void;
  removeHistoryCareer: (id: string) => Promise<void>;
  startCareer: (profile: PlayerProfile, mode: DraftMode) => void;
  continueCareer: () => void;
  abandonCareer: () => void;
  /** Aplica uma transição do motor na carreira atual e salva. */
  act: (transition: (c: Career) => Career) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  openRetiredCareer: () => void;
  saveRetiredCareer: () => Promise<SaveCareerResult>;
  discardRetiredCareer: () => void;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  syncNow: () => void;
  resolveConflict: (choice: 'local' | 'cloud' | 'later') => void;
  showConflict: () => void;
  uploadLocalHistory: () => Promise<number>;
  dismissNotice: () => void;
}

const GameContext = createContext<GameApi | null>(null);

/** Antes de substituir uma carreira ativa, guarda uma cópia (proteção contra perda acidental). */
function backupReplaced(store: KeyValueStore, career: Career | null): void {
  if (!career) return;
  try {
    store.setItem(`${STORAGE_KEYS.quarantine}:replaced`, JSON.stringify(career));
  } catch {
    /* sem espaço: a cópia de segurança é opcional */
  }
}

export function mergeHistory(local: CareerSummary[], cloud: CareerSummary[], uid: string | null): HistoryItem[] {
  const items = new Map<string, HistoryItem>();
  if (uid) {
    for (const s of cloud) items.set(s.careerId, { summary: s, local: false, cloud: true });
  }
  for (const s of local) {
    const inCloud = items.get(s.careerId);
    if (inCloud) {
      inCloud.local = true;
      continue;
    }
    // Conectado: só mostra o que é desta conta ou ainda não foi enviado para nenhuma conta.
    if (uid && s.cloudUid && s.cloudUid !== uid) continue;
    items.set(s.careerId, { summary: s, local: true, cloud: false });
  }
  return [...items.values()].sort((a, b) => b.summary.savedAt - a.summary.savedAt);
}

export function GameProvider({
  children,
  store: injected,
  cloud: injectedCloud,
}: {
  children: ReactNode;
  store?: KeyValueStore;
  /** Serviço de nuvem (injeção para testes). Sem ele, usa o Firebase configurado no .env. */
  cloud?: CloudService | null;
}) {
  const store = useMemo(() => injected ?? browserStore(), [injected]);
  const cloudAvailable = injectedCloud !== undefined ? injectedCloud !== null : configuredCloud;
  const [state, setState] = useState<GameState>(() => ({
    screen: 'home',
    career: null,
    savedCareer: loadCurrent(store),
    retiredCareer: loadRetired(store),
    localHistory: loadCareerHistory(store),
    cloudHistory: [],
    historyId: null,
    settings: loadSettings(store),
    user: null,
    authReady: !cloudAvailable,
    sync: { state: 'off' },
    localSave: { ok: true, at: null },
    notice: null,
  }));

  // Espelho síncrono do estado: as gravações acontecem fora do setState
  // (no StrictMode o updater roda duas vezes e o save divergiria do estado em tela).
  const ref = useRef(state);
  const commit = useCallback((patch: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => {
    const p = typeof patch === 'function' ? patch(ref.current) : patch;
    ref.current = { ...ref.current, ...p };
    setState(ref.current);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion);
  }, [state.settings.reduceMotion]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.screen, state.career?.phase, state.career?.eventIndex]);

  // ---------- Nuvem ----------

  const cloudRef = useRef<CloudService | null>(injectedCloud ?? null);
  const getCloud = useCallback(async (): Promise<CloudService | null> => {
    if (cloudRef.current) return cloudRef.current;
    if (injectedCloud !== undefined || !firebaseSettings) return null;
    const mod = await import('../cloud/service');
    cloudRef.current = mod.createFirebaseService(firebaseSettings);
    return cloudRef.current;
  }, [injectedCloud]);

  /** Fila: sincronizações nunca rodam em paralelo. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const exclusive = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(fn, fn);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const setSync = useCallback((sync: SyncStatus) => commit({ sync }), [commit]);

  const refreshCloudHistory = useCallback(
    async (uid: string) => {
      const svc = await getCloud();
      if (!svc) return;
      try {
        const raw = await svc.listCareers(uid);
        if (ref.current.user?.uid !== uid) return;
        commit({ cloudHistory: raw.map(sanitizeSummary).filter((x): x is CareerSummary => x !== null) });
      } catch {
        /* a lista da nuvem é recarregada na próxima entrada */
      }
    },
    [commit, getCloud],
  );

  /** Envia (ou remove) a carreira ativa, exigindo que a nuvem esteja na versão `expected`. */
  const push = useCallback(
    async (uid: string, career: Career | null, expected: ActiveVersion | null): Promise<'ok' | 'conflict' | 'error'> => {
      const svc = await getCloud();
      if (!svc) return 'error';
      setSync({ state: 'saving' });
      try {
        await svc.pushActive(uid, career, expected);
        saveSyncMeta(store, { uid, version: versionOf(career) });
        if (ref.current.user?.uid === uid) setSync({ state: 'synced', lastSyncedAt: Date.now() });
        return 'ok';
      } catch (err) {
        if (err instanceof CloudConflictError) return 'conflict';
        setSync({ state: 'error', message: err instanceof Error ? err.message : 'Falha ao sincronizar.' });
        return 'error';
      }
    },
    [getCloud, setSync, store],
  );

  /** Compara este aparelho com a nuvem e decide com segurança (pode pedir confirmação). */
  const reconcile = useCallback(
    async (uid: string): Promise<void> => {
      const svc = await getCloud();
      if (!svc || ref.current.user?.uid !== uid) return;
      setSync({ state: 'checking' });
      let cloud;
      try {
        cloud = await svc.fetchActive(uid);
      } catch (err) {
        setSync({ state: 'error', message: err instanceof Error ? err.message : 'Falha ao consultar a nuvem.' });
        return;
      }
      if (ref.current.user?.uid !== uid) return;
      const local = ref.current.savedCareer;
      const cloudVersion = cloud?.version ?? null;
      const cloudCareer = cloud ? sanitizeCareer(cloud.career) : null;

      // A carreira da nuvem já foi encerrada neste aparelho: remove da nuvem em vez de ressuscitá-la.
      const endedHere =
        !!cloudVersion &&
        (ref.current.retiredCareer?.id === cloudVersion.careerId || ref.current.localHistory.some((s) => s.careerId === cloudVersion.careerId));
      if (!local && endedHere) {
        const r = await push(uid, null, cloudVersion);
        if (r === 'conflict') setSync({ state: 'error', message: 'A nuvem mudou durante a sincronização. Tente de novo.' });
        return;
      }

      const decision = decideSync(versionOf(local), cloudVersion, loadSyncMeta(store), uid);
      switch (decision.kind) {
        case 'in-sync':
          saveSyncMeta(store, { uid, version: cloudVersion });
          setSync({ state: 'synced', lastSyncedAt: Date.now() });
          return;
        case 'push': {
          const r = await push(uid, local, decision.expected);
          if (r === 'conflict') setSync({ state: 'error', message: 'A nuvem mudou durante a sincronização. Tente de novo.' });
          return;
        }
        case 'adopt-cloud': {
          if (!cloudCareer) {
            setSync({ state: 'error', message: 'O save da nuvem está inválido. Nada foi alterado neste aparelho.' });
            return;
          }
          if (!saveCurrent(store, cloudCareer)) {
            setSync({ state: 'error', message: 'Não foi possível gravar neste navegador.' });
            return;
          }
          saveSyncMeta(store, { uid, version: cloudVersion });
          commit((s) => ({
            savedCareer: cloudCareer,
            career: s.career && s.career.phase !== 'retired' ? cloudCareer : s.career,
            sync: { state: 'synced', lastSyncedAt: Date.now() },
            notice: local ? 'Carreira atualizada com a versão mais recente da nuvem.' : 'Carreira da nuvem disponível neste aparelho.',
          }));
          return;
        }
        case 'conflict':
          setSync({
            state: 'conflict',
            conflict: { reason: decision.reason, local, cloud: cloudCareer, cloudVersion, deferred: false },
          });
      }
    },
    [commit, getCloud, push, setSync, store],
  );

  /** Envia a carreira ativa se só este aparelho mudou; senão, reconcilia. */
  const syncActive = useCallback(
    (uid: string) =>
      exclusive(async () => {
        if (ref.current.user?.uid !== uid || ref.current.sync.state === 'conflict') return;
        const meta = loadSyncMeta(store);
        const local = ref.current.savedCareer;
        if (!meta || meta.uid !== uid) return reconcile(uid);
        if (sameVersion(versionOf(local), meta.version)) {
          if (ref.current.sync.state !== 'synced') setSync({ state: 'synced', lastSyncedAt: Date.now() });
          return;
        }
        const r = await push(uid, local, meta.version);
        if (r === 'conflict') await reconcile(uid);
      }),
    [exclusive, push, reconcile, setSync, store],
  );

  const syncTimer = useRef<number | undefined>(undefined);
  const scheduleSync = useCallback(() => {
    const uid = ref.current.user?.uid;
    if (!uid) return;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => void syncActive(uid), 900);
  }, [syncActive]);

  // Autenticação: ao entrar (ou ao abrir o jogo já conectado) compara com a nuvem.
  const handledUid = useRef<string | null>(null);
  useEffect(() => {
    if (!cloudAvailable) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void getCloud().then((svc) => {
      if (!svc || cancelled) return;
      unsub = svc.onAuthChange((user) => {
        if (!user) {
          handledUid.current = null;
          commit({ user: null, authReady: true, cloudHistory: [], sync: { state: 'off' } });
          return;
        }
        commit({ user, authReady: true });
        if (handledUid.current === user.uid) return;
        handledUid.current = user.uid;
        void exclusive(() => reconcile(user.uid));
        void refreshCloudHistory(user.uid);
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [cloudAvailable, commit, exclusive, getCloud, reconcile, refreshCloudHistory]);

  useEffect(() => () => window.clearTimeout(syncTimer.current), []);

  // Outra aba deste navegador gravou o save: adota a versão dela em vez de sobrescrevê-la depois
  // com um estado desatualizado (o localStorage é compartilhado entre abas).
  useEffect(() => {
    if (injected) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.current) {
        const saved = loadCurrent(store);
        commit((s) => ({
          savedCareer: saved,
          career: s.screen === 'game' && s.career && s.career.phase !== 'retired' ? saved : s.career,
          screen: s.screen === 'game' && s.career && s.career.phase !== 'retired' && !saved ? 'home' : s.screen,
          notice: s.screen === 'game' ? 'A carreira foi atualizada em outra aba. Continuando da versão mais recente.' : s.notice,
        }));
      } else if (e.key === STORAGE_KEYS.retired) {
        commit({ retiredCareer: loadRetired(store) });
      } else if (e.key === STORAGE_KEYS.careers) {
        commit({ localHistory: loadCareerHistory(store) });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [commit, injected, store]);

  // ---------- Carreira ----------

  const act = useCallback(
    (transition: (c: Career) => Career) => {
      const s = ref.current;
      if (!s.career) return;
      let next: Career;
      try {
        next = transition(s.career);
      } catch (err) {
        console.error('FootRise: transição falhou', err);
        return;
      }
      if (next === s.career) return;
      if (next.phase === 'retired' && s.career.phase !== 'retired') {
        // A carreira deixa de ser ativa: vai para o slot de aposentada (até ser salva no histórico).
        const ok = moveToRetired(store, next);
        commit({
          career: next,
          savedCareer: ok ? null : s.savedCareer,
          retiredCareer: ok ? next : s.retiredCareer,
          localHistory: loadCareerHistory(store),
          localSave: { ok, at: Date.now() },
        });
      } else {
        const ok = saveCurrent(store, next);
        commit({ career: next, savedCareer: next, localSave: { ok, at: Date.now() } });
      }
      scheduleSync();
    },
    [commit, scheduleSync, store],
  );

  const saveRetiredCareer = useCallback(async (): Promise<SaveCareerResult> => {
    const retired = ref.current.retiredCareer;
    if (!retired) return { ok: true, cloud: null, message: 'Carreira já salva.' };
    const summary = buildCareerSummary(retired);
    const local = saveCareerSummary(store, summary);
    if (!local.ok) {
      commit({ notice: 'Não foi possível salvar neste navegador (armazenamento cheio?). A carreira continua aguardando.' });
      return { ok: false, cloud: null, message: 'Falha ao salvar neste navegador.' };
    }
    saveRetired(store, null);
    commit({ retiredCareer: null, localHistory: local.history });

    const uid = ref.current.user?.uid;
    const svc = uid ? await getCloud() : null;
    if (!uid || !svc) return { ok: true, cloud: null, message: 'Carreira salva neste aparelho.' };
    try {
      await svc.saveCareer(uid, summary);
      const marked = saveCareerSummary(store, { ...summary, cloudUid: uid });
      commit({ localHistory: marked.history });
      void refreshCloudHistory(uid);
      return { ok: true, cloud: true, message: 'Carreira salva neste aparelho e na sua conta.' };
    } catch (err) {
      return {
        ok: true,
        cloud: false,
        message: `Salva neste aparelho. Nuvem: ${err instanceof Error ? err.message : 'falhou'} Você pode enviar depois pelo histórico.`,
      };
    }
  }, [commit, getCloud, refreshCloudHistory, store]);

  const uploadLocalHistory = useCallback(async (): Promise<number> => {
    const uid = ref.current.user?.uid;
    const svc = uid ? await getCloud() : null;
    if (!uid || !svc) return 0;
    const cloudIds = new Set(ref.current.cloudHistory.map((s) => s.careerId));
    const pending = ref.current.localHistory.filter((s) => !cloudIds.has(s.careerId) && (!s.cloudUid || s.cloudUid === uid));
    let sent = 0;
    for (const s of pending) {
      try {
        await svc.saveCareer(uid, s);
        saveCareerSummary(store, { ...s, cloudUid: uid });
        sent++;
      } catch (err) {
        commit({ notice: err instanceof Error ? err.message : 'Falha ao enviar.' });
        break;
      }
    }
    commit({ localHistory: loadCareerHistory(store) });
    await refreshCloudHistory(uid);
    return sent;
  }, [commit, getCloud, refreshCloudHistory, store]);

  const resolveConflict = useCallback(
    (choice: 'local' | 'cloud' | 'later') => {
      const s = ref.current;
      const conflict = s.sync.conflict;
      const uid = s.user?.uid;
      if (!conflict || !uid) return;
      if (choice === 'later') {
        setSync({ ...s.sync, conflict: { ...conflict, deferred: true } });
        return;
      }
      void exclusive(async () => {
        if (choice === 'local') {
          // Este aparelho vence: substitui a versão da nuvem que o jogador viu no aviso.
          const r = await push(uid, ref.current.savedCareer, conflict.cloudVersion);
          if (r === 'conflict') await reconcile(uid);
          return;
        }
        // A nuvem vence: guarda cópia de segurança da versão local antes de substituir.
        backupReplaced(store, ref.current.savedCareer);
        if (!saveCurrent(store, conflict.cloud)) {
          setSync({ state: 'error', message: 'Não foi possível gravar neste navegador.' });
          return;
        }
        saveSyncMeta(store, { uid, version: conflict.cloudVersion });
        commit((cur) => ({
          savedCareer: conflict.cloud,
          career: cur.career && cur.career.phase !== 'retired' ? conflict.cloud : cur.career,
          screen: cur.screen === 'game' && !conflict.cloud ? 'home' : cur.screen,
          sync: { state: 'synced', lastSyncedAt: Date.now() },
          notice: conflict.cloud ? 'Carreira da nuvem carregada.' : 'Carreira removida deste aparelho.',
        }));
      });
    },
    [commit, exclusive, push, reconcile, setSync, store],
  );

  const history = useMemo(
    () => mergeHistory(state.localHistory, state.cloudHistory, state.user?.uid ?? null),
    [state.localHistory, state.cloudHistory, state.user],
  );

  const requireCloud = async (): Promise<CloudService> => {
    const svc = await getCloud();
    if (!svc) throw new CloudError('Salvamento na nuvem não está configurado.');
    return svc;
  };

  const api: GameApi = {
    ...state,
    history,
    cloudAvailable,
    act,
    goHome: () =>
      commit({
        screen: 'home',
        career: null,
        historyId: null,
        savedCareer: loadCurrent(store),
        retiredCareer: loadRetired(store),
      }),
    goCreate: () => commit({ screen: 'create' }),
    goAccount: () => commit({ screen: 'account' }),
    goHistory: () => commit({ screen: 'history', career: null, localHistory: loadCareerHistory(store), historyId: null }),
    openHistoryCareer: (id) => commit({ screen: 'history-detail', historyId: id }),
    removeHistoryCareer: async (id) => {
      const item = history.find((h) => h.summary.careerId === id);
      const res = deleteCareerSummary(store, id);
      commit({ localHistory: res.history });
      const uid = ref.current.user?.uid;
      if (uid && item?.cloud) {
        try {
          await (await requireCloud()).deleteCareer(uid, id);
          await refreshCloudHistory(uid);
        } catch (err) {
          commit({ notice: err instanceof Error ? err.message : 'Falha ao remover da nuvem.' });
        }
      }
    },
    startCareer: (profile, mode) => {
      const career = createCareer(profile, mode);
      backupReplaced(store, ref.current.savedCareer);
      const ok = saveCurrent(store, career);
      commit({ screen: 'game', career, savedCareer: career, localSave: { ok, at: Date.now() } });
      scheduleSync();
    },
    continueCareer: () => {
      const saved = ref.current.savedCareer;
      if (saved) commit({ screen: 'game', career: saved });
    },
    abandonCareer: () => {
      backupReplaced(store, ref.current.savedCareer);
      saveCurrent(store, null);
      commit({ savedCareer: null, career: null });
      scheduleSync();
    },
    updateSettings: (patch) => {
      const settings = { ...ref.current.settings, ...patch };
      saveSettings(store, settings);
      commit({ settings });
    },
    openRetiredCareer: () => {
      const retired = ref.current.retiredCareer;
      if (retired) commit({ screen: 'game', career: retired });
    },
    saveRetiredCareer,
    discardRetiredCareer: () => {
      saveRetired(store, null);
      commit({ retiredCareer: null });
    },
    signUp: async (username, email, password) => {
      const user = await (await requireCloud()).signUp(username, email, password);
      commit({ user, authReady: true });
    },
    signIn: async (email, password) => {
      const user = await (await requireCloud()).signIn(email, password);
      commit({ user, authReady: true });
    },
    signOut: async () => {
      window.clearTimeout(syncTimer.current);
      await (await requireCloud()).signOut();
      handledUid.current = null;
      commit({ user: null, cloudHistory: [], sync: { state: 'off' } });
    },
    resetPassword: async (email) => {
      await (await requireCloud()).resetPassword(email);
    },
    syncNow: () => {
      const uid = ref.current.user?.uid;
      if (!uid) return;
      void exclusive(() => reconcile(uid));
      void refreshCloudHistory(uid);
    },
    resolveConflict,
    showConflict: () => {
      const s = ref.current.sync;
      if (s.conflict) setSync({ ...s, conflict: { ...s.conflict, deferred: false } });
    },
    uploadLocalHistory,
    dismissNotice: () => commit({ notice: null }),
  };

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame precisa estar dentro de GameProvider');
  return ctx;
}

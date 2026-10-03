import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { CAREER } from '../config/balance';
import type { ActiveVersion } from '../state/storage';
import type { CareerSummary } from '../types';
import type { FirebaseSettings } from './config';
import { CloudConflictError, CloudError, type CloudActive, type CloudProfile, type CloudService, type CloudUser } from './types';

// Estrutura no Firestore (todas as regras exigem request.auth.uid == {uid}):
//   users/{uid}                    perfil: uid, username, email, createdAt
//   users/{uid}/active/current     carreira ativa: careerId, updatedAt, saveVersion, savedAt, data (JSON)
//   users/{uid}/careers/{careerId} carreira encerrada: resumo completo (JSON) + campos para listagem
//
// O estado da carreira vai como texto JSON: preserva exatamente o objeto salvo localmente
// (o Firestore não aceita listas aninhadas nem valores undefined).

const AUTH_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/missing-password': 'Digite a senha.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/operation-not-allowed': 'Login por e-mail e senha não está habilitado neste projeto Firebase.',
  'permission-denied': 'Acesso negado pela nuvem.',
  unavailable: 'Nuvem indisponível no momento. Seus dados continuam salvos neste aparelho.',
};

export function friendlyError(err: unknown): CloudError {
  if (err instanceof CloudError || err instanceof CloudConflictError) return err as CloudError;
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : undefined;
  const message = (code && AUTH_MESSAGES[code]) ?? 'Não foi possível falar com a nuvem. Tente novamente.';
  return new CloudError(message, code);
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CloudConflictError) throw err;
    throw friendlyError(err);
  }
}

const MAX_DOC_CHARS = 950_000;

/** Nome de usuário aceito pelas regras do Firestore (2–24 caracteres), ou undefined. */
function validName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim().slice(0, 24);
  return trimmed && trimmed.length >= 2 ? trimmed : undefined;
}

function toMillis(v: unknown): number | null {
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: unknown }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return typeof v === 'number' ? v : null;
}

export function createFirebaseService(settings: FirebaseSettings, appName = '[DEFAULT]'): CloudService {
  const existing = getApps().find((a) => a.name === appName);
  const app: FirebaseApp =
    existing ??
    initializeApp(
      {
        apiKey: settings.apiKey,
        authDomain: settings.authDomain,
        projectId: settings.projectId,
        appId: settings.appId,
        storageBucket: settings.storageBucket,
        messagingSenderId: settings.messagingSenderId,
      },
      appName,
    );
  const auth: Auth = getAuth(app);
  const db: Firestore = getFirestore(app);
  if (settings.useEmulator && !existing) {
    connectAuthEmulator(auth, `http://${settings.emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, settings.emulatorHost, 8080);
  }

  const profileRef = (uid: string) => doc(db, 'users', uid);
  const activeRef = (uid: string) => doc(db, 'users', uid, 'active', 'current');
  const careerRef = (uid: string, id: string) => doc(db, 'users', uid, 'careers', id);

  async function getProfile(uid: string): Promise<CloudProfile | null> {
    const snap = await getDoc(profileRef(uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { uid, username: String(d.username ?? ''), email: String(d.email ?? ''), createdAt: toMillis(d.createdAt) };
  }

  /** Cria o perfil só se ele ainda não existir (o listener de autenticação e o cadastro podem chegar juntos). */
  async function createProfileIfMissing(user: User, username: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(profileRef(user.uid));
      if (!snap.exists()) tx.set(profileRef(user.uid), { uid: user.uid, username, email: user.email ?? '', createdAt: serverTimestamp() });
    });
  }

  /** Nome que o cadastro antigo gerava a partir do e-mail quando o perfil era criado sem o nome escolhido. */
  const emailDerivedName = (user: User) => validName(user.email?.split('@')[0]) ?? 'Jogador';

  /** Cadastro em andamento neste aparelho: o listener de autenticação usa o nome escolhido. */
  let pendingSignUpName: string | null = null;

  /**
   * Usuário do jogo: o nome vem do perfil no Firestore (criado se estiver faltando).
   * Contas criadas quando o perfil recebia o nome derivado do e-mail recuperam o nome escolhido
   * no cadastro (guardado no displayName do Auth) — só o campo username é atualizado.
   */
  async function toCloudUser(user: User, usernameHint?: string): Promise<CloudUser> {
    const chosen = validName(usernameHint) ?? validName(pendingSignUpName) ?? validName(user.displayName);
    let profile: CloudProfile | null = null;
    try {
      profile = await getProfile(user.uid);
      if (!profile) {
        await createProfileIfMissing(user, chosen ?? emailDerivedName(user));
        profile = await getProfile(user.uid);
      }
      if (profile && chosen && profile.username !== chosen && (usernameHint || profile.username === emailDerivedName(user))) {
        profile = { ...profile, username: chosen };
        await updateDoc(profileRef(user.uid), { username: chosen });
      }
    } catch {
      /* perfil indisponível: segue com os dados da autenticação */
    }
    return { uid: user.uid, email: user.email ?? '', username: profile?.username || chosen || user.email || 'Jogador' };
  }

  return {
    onAuthChange(cb) {
      return onAuthStateChanged(auth, (user) => {
        if (!user) cb(null);
        else void toCloudUser(user).then(cb, () => cb({ uid: user.uid, email: user.email ?? '', username: user.displayName ?? 'Jogador' }));
      });
    },

    signUp: (username, email, password) =>
      guard(async () => {
        pendingSignUpName = username;
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          try {
            await updateProfile(cred.user, { displayName: username });
          } catch {
            /* o nome também fica no Firestore */
          }
          await createProfileIfMissing(cred.user, username);
          return await toCloudUser(cred.user, username);
        } finally {
          pendingSignUpName = null;
        }
      }),

    signIn: (email, password) =>
      guard(async () => {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return toCloudUser(cred.user);
      }),

    signOut: () => guard(() => fbSignOut(auth)),

    resetPassword: (email) => guard(() => sendPasswordResetEmail(auth, email)),

    getProfile: (uid) => guard(() => getProfile(uid)),

    fetchActive: (uid) =>
      guard(async () => {
        const snap = await getDoc(activeRef(uid));
        if (!snap.exists()) return null;
        const d = snap.data();
        let career: unknown = null;
        try {
          career = JSON.parse(String(d.data));
        } catch {
          career = null;
        }
        const active: CloudActive = {
          version: { careerId: String(d.careerId), updatedAt: Number(d.updatedAt) },
          career,
          savedAt: toMillis(d.savedAt),
        };
        return active;
      }),

    pushActive: (uid, career, expected) =>
      guard(async () => {
        const data = career ? JSON.stringify(career) : '';
        if (data.length > MAX_DOC_CHARS) throw new CloudError('A carreira ficou grande demais para a nuvem. Ela continua salva neste aparelho.');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(activeRef(uid));
          const current: ActiveVersion | null = snap.exists()
            ? { careerId: String(snap.data().careerId), updatedAt: Number(snap.data().updatedAt) }
            : null;
          const same = !current || !expected ? current === expected : current.careerId === expected.careerId && current.updatedAt === expected.updatedAt;
          if (!same) throw new CloudConflictError();
          if (career) {
            tx.set(activeRef(uid), {
              careerId: career.id,
              updatedAt: career.updatedAt,
              saveVersion: CAREER.saveVersion,
              savedAt: serverTimestamp(),
              data,
            });
          } else if (snap.exists()) {
            tx.delete(activeRef(uid));
          }
        });
      }),

    listCareers: (uid) =>
      guard(async () => {
        const snaps = await getDocs(collection(db, 'users', uid, 'careers'));
        const out: unknown[] = [];
        snaps.forEach((s) => {
          try {
            out.push(JSON.parse(String(s.data().data)));
          } catch {
            /* documento inválido: ignorado na listagem */
          }
        });
        return out;
      }),

    saveCareer: (uid, summary: CareerSummary) =>
      guard(async () => {
        const data = JSON.stringify({ ...summary, cloudUid: uid });
        if (data.length > MAX_DOC_CHARS) throw new CloudError('Resumo grande demais para a nuvem.');
        await setDoc(careerRef(uid, summary.careerId), {
          careerId: summary.careerId,
          ownerUid: uid,
          summaryVersion: summary.summaryVersion,
          savedAt: summary.savedAt,
          name: summary.player.name,
          legacyScore: summary.legacy.score,
          data,
        });
      }),

    deleteCareer: (uid, careerId) => guard(() => deleteDoc(careerRef(uid, careerId))),
  };
}

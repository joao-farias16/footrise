// Configuração do Firebase via variáveis de ambiente do Vite (arquivo .env.local — ver .env.example).
// Sem configuração, o jogo funciona normalmente apenas com o salvamento local.

export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  /** Usa o Firebase Emulator Suite local (desenvolvimento e testes). */
  useEmulator: boolean;
  emulatorHost: string;
}

type Env = Record<string, string | boolean | undefined>;

export function readFirebaseSettings(env: Env): FirebaseSettings | null {
  const get = (k: string) => {
    const v = env[k];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const apiKey = get('VITE_FIREBASE_API_KEY');
  const authDomain = get('VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = get('VITE_FIREBASE_PROJECT_ID');
  const appId = get('VITE_FIREBASE_APP_ID');
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: get('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: get('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    useEmulator: get('VITE_FIREBASE_USE_EMULATOR') === 'true',
    emulatorHost: get('VITE_FIREBASE_EMULATOR_HOST') ?? '127.0.0.1',
  };
}

export const firebaseSettings: FirebaseSettings | null = readFirebaseSettings(
  (import.meta as unknown as { env?: Env }).env ?? {},
);

export const cloudAvailable = firebaseSettings !== null;

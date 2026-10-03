import type { ActiveVersion } from '../state/storage';
import type { Career, CareerSummary } from '../types';

// Contrato da nuvem usado pelo jogo. A implementação real (Firebase) fica em service.ts e é
// carregada sob demanda; o restante do app não depende do SDK.

export interface CloudUser {
  uid: string;
  email: string;
  username: string;
}

export interface CloudProfile {
  uid: string;
  username: string;
  email: string;
  createdAt: number | null;
}

export interface CloudActive {
  version: ActiveVersion;
  /** Dados crus (validados por sanitizeCareer antes do uso). */
  career: unknown;
  savedAt: number | null;
}

/** A nuvem mudou desde a última sincronização: nada foi gravado. */
export class CloudConflictError extends Error {
  constructor() {
    super('A carreira na nuvem mudou desde a última sincronização.');
    this.name = 'CloudConflictError';
  }
}

/** Erro com mensagem amigável para exibir ao jogador. */
export class CloudError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export interface CloudService {
  onAuthChange(cb: (user: CloudUser | null) => void): () => void;
  signUp(username: string, email: string, password: string): Promise<CloudUser>;
  signIn(email: string, password: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getProfile(uid: string): Promise<CloudProfile | null>;
  fetchActive(uid: string): Promise<CloudActive | null>;
  /**
   * Grava (ou remove, com `career = null`) a carreira ativa — só se a versão atual da nuvem
   * for exatamente `expected`. Caso contrário lança CloudConflictError e não grava nada.
   */
  pushActive(uid: string, career: Career | null, expected: ActiveVersion | null): Promise<void>;
  listCareers(uid: string): Promise<unknown[]>;
  saveCareer(uid: string, summary: CareerSummary): Promise<void>;
  deleteCareer(uid: string, careerId: string): Promise<void>;
}

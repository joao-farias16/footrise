import type { Career } from '../types';
import type { ActiveVersion, SyncMeta } from './storage';

// Decide o que fazer com a carreira ativa quando existem uma cópia neste aparelho e outra na
// nuvem. Regra de ouro: nunca substituir uma cópia que tenha mudanças que a outra não tem.
//
// `meta.version` é o estado que estava IGUAL nos dois lados na última sincronização desta conta.
// Comparando cada lado com ele dá para saber quem mudou desde então.

export type SyncDecision =
  | { kind: 'in-sync' }
  /** Só este aparelho mudou: enviar (substituindo a versão `expected` da nuvem). */
  | { kind: 'push'; expected: ActiveVersion | null }
  /** Só a nuvem mudou (ou este aparelho não tem carreira): carregar a da nuvem. */
  | { kind: 'adopt-cloud' }
  | { kind: 'conflict'; reason: ConflictReason };

export type ConflictReason =
  /** A mesma carreira avançou nos dois lados. */
  | 'diverged'
  /** Carreiras diferentes aqui e na nuvem. */
  | 'different-career'
  /** A carreira foi encerrada/descartada em outro aparelho, mas segue ativa aqui. */
  | 'deleted-elsewhere'
  /** A carreira deste aparelho foi sincronizada com outra conta. */
  | 'other-account';

export function versionOf(c: Pick<Career, 'id' | 'updatedAt'> | null | undefined): ActiveVersion | null {
  return c ? { careerId: c.id, updatedAt: c.updatedAt } : null;
}

export function sameVersion(a: ActiveVersion | null, b: ActiveVersion | null): boolean {
  if (!a || !b) return a === b;
  return a.careerId === b.careerId && a.updatedAt === b.updatedAt;
}

export function decideSync(local: ActiveVersion | null, cloud: ActiveVersion | null, meta: SyncMeta | null, uid: string): SyncDecision {
  if (sameVersion(local, cloud)) return { kind: 'in-sync' };

  const base = meta && meta.uid === uid ? meta.version : undefined;
  if (base !== undefined) {
    if (sameVersion(cloud, base)) return { kind: 'push', expected: cloud };
    if (sameVersion(local, base)) return cloud ? { kind: 'adopt-cloud' } : { kind: 'conflict', reason: 'deleted-elsewhere' };
    return { kind: 'conflict', reason: local && cloud && local.careerId === cloud.careerId ? 'diverged' : 'different-career' };
  }

  // Primeira sincronização desta conta neste aparelho.
  const ownedByOther = !!meta && meta.uid !== uid && !!local && meta.version?.careerId === local.careerId;
  if (ownedByOther) return { kind: 'conflict', reason: 'other-account' };
  if (!local) return { kind: 'adopt-cloud' };
  if (!cloud) return { kind: 'push', expected: null };
  return { kind: 'conflict', reason: local.careerId === cloud.careerId ? 'diverged' : 'different-career' };
}

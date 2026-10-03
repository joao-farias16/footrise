import { describe, expect, it } from 'vitest';
import { mergeHistory } from './GameContext';
import type { CareerSummary } from '../types';
import { decideSync } from './sync';

const v = (careerId: string, updatedAt: number) => ({ careerId, updatedAt });
const A1 = v('a', 1);
const A2 = v('a', 2);
const A3 = v('a', 3);
const B1 = v('b', 1);

describe('decisão de sincronização', () => {
  it('iguais: nada a fazer', () => {
    expect(decideSync(A1, A1, null, 'u')).toEqual({ kind: 'in-sync' });
    expect(decideSync(null, null, null, 'u')).toEqual({ kind: 'in-sync' });
  });

  it('só este aparelho avançou: envia', () => {
    expect(decideSync(A2, A1, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'push', expected: A1 });
    // Nova carreira criada aqui depois de sincronizar a anterior.
    expect(decideSync(B1, A1, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'push', expected: A1 });
    // Carreira encerrada aqui: remove da nuvem.
    expect(decideSync(null, A1, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'push', expected: A1 });
  });

  it('só a nuvem avançou: carrega a da nuvem', () => {
    expect(decideSync(A1, A2, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'adopt-cloud' });
    expect(decideSync(null, A1, null, 'u')).toEqual({ kind: 'adopt-cloud' });
  });

  it('os dois avançaram: pede escolha (nunca sobrescreve sozinho)', () => {
    expect(decideSync(A3, A2, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'conflict', reason: 'diverged' });
    expect(decideSync(B1, A2, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'conflict', reason: 'different-career' });
    // Primeira vez nesta conta, com carreiras diferentes dos dois lados.
    expect(decideSync(B1, A1, null, 'u')).toEqual({ kind: 'conflict', reason: 'different-career' });
    expect(decideSync(A2, A1, null, 'u')).toEqual({ kind: 'conflict', reason: 'diverged' });
  });

  it('encerrada em outro aparelho enquanto continuava aqui: pede escolha', () => {
    expect(decideSync(A1, null, { uid: 'u', version: A1 }, 'u')).toEqual({ kind: 'conflict', reason: 'deleted-elsewhere' });
  });

  it('carreira ligada a outra conta não é enviada para a conta nova sem confirmação', () => {
    expect(decideSync(A2, null, { uid: 'outra', version: A1 }, 'u')).toEqual({ kind: 'conflict', reason: 'other-account' });
    expect(decideSync(A2, B1, { uid: 'outra', version: A1 }, 'u')).toEqual({ kind: 'conflict', reason: 'other-account' });
    // Carreira nunca sincronizada (criada sem conta): pode ir para a conta que entrou.
    expect(decideSync(A1, null, { uid: 'outra', version: B1 }, 'u')).toEqual({ kind: 'push', expected: null });
  });
});

describe('histórico local + nuvem', () => {
  const sum = (careerId: string, savedAt: number, cloudUid: string | null = null) => ({ careerId, savedAt, cloudUid }) as CareerSummary;

  it('desconectado: tudo que está neste aparelho', () => {
    const items = mergeHistory([sum('a', 1), sum('b', 2, 'x')], [], null);
    expect(items.map((i) => i.summary.careerId)).toEqual(['b', 'a']);
  });

  it('conectado: junta sem duplicar e esconde carreiras de outra conta', () => {
    const items = mergeHistory([sum('a', 1, 'u'), sum('b', 2), sum('c', 3, 'outra')], [sum('a', 1, 'u'), sum('d', 4, 'u')], 'u');
    expect(items.map((i) => i.summary.careerId)).toEqual(['d', 'b', 'a']);
    expect(items.find((i) => i.summary.careerId === 'a')).toMatchObject({ local: true, cloud: true });
    expect(items.find((i) => i.summary.careerId === 'b')).toMatchObject({ local: true, cloud: false });
    expect(items.find((i) => i.summary.careerId === 'd')).toMatchObject({ local: false, cloud: true });
  });
});

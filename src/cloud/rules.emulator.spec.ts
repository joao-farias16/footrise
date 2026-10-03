import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Regras do Firestore contra o emulador (npm run test:cloud).

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-footrise',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const alice = () => env.authenticatedContext('alice', { email: 'alice@ex.com' }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@ex.com' }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const profile = { uid: 'alice', username: 'Alice', email: 'alice@ex.com', createdAt: serverTimestamp() };
const active = () => ({ careerId: 'c1', updatedAt: 10, saveVersion: 1, savedAt: serverTimestamp(), data: '{"id":"c1"}' });
const career = () => ({ careerId: 'c1', ownerUid: 'alice', summaryVersion: 1, savedAt: 10, name: 'Jogador', legacyScore: 50, data: '{"careerId":"c1"}' });

describe('perfil users/{uid}', () => {
  it('dono cria e lê o próprio perfil', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), profile));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
  });

  it('ninguém lê ou cria o perfil de outro', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), { ...profile, createdAt: 1 }));
    await assertFails(getDoc(doc(bob(), 'users/alice')));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
    await assertFails(setDoc(doc(bob(), 'users/alice'), profile));
  });

  it('perfil não aceita campos extras (ex.: senha), e-mail diferente da conta ou nome inválido', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile, password: '123456' }));
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile, email: 'outro@ex.com' }));
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile, username: 'A' }));
  });

  it('só o nome de usuário pode ser alterado; perfil não pode ser apagado', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), profile));
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { username: 'Alice B' }));
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { email: 'x@ex.com' }));
    await assertFails(deleteDoc(doc(alice(), 'users/alice')));
  });
});

describe('carreira ativa users/{uid}/active/current', () => {
  it('dono grava, lê e apaga', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/active/current'), active()));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/active/current')));
    await assertSucceeds(deleteDoc(doc(alice(), 'users/alice/active/current')));
  });

  it('outro usuário e anônimo não leem nem escrevem', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice/active/current'), { ...active(), savedAt: 1 }));
    await assertFails(getDoc(doc(bob(), 'users/alice/active/current')));
    await assertFails(setDoc(doc(bob(), 'users/alice/active/current'), active()));
    await assertFails(deleteDoc(doc(bob(), 'users/alice/active/current')));
    await assertFails(getDoc(doc(anon(), 'users/alice/active/current')));
  });

  it('só o documento "current", com formato válido', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/active/outro'), active()));
    await assertFails(setDoc(doc(alice(), 'users/alice/active/current'), { ...active(), data: '' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/active/current'), { ...active(), extra: true }));
    await assertFails(setDoc(doc(alice(), 'users/alice/active/current'), { ...active(), data: 'x'.repeat(950_001) }));
  });
});

describe('histórico users/{uid}/careers/{careerId}', () => {
  it('dono salva, lista e exclui', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/careers/c1'), career()));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/careers/c1')));
    await assertSucceeds(deleteDoc(doc(alice(), 'users/alice/careers/c1')));
  });

  it('id e dono precisam bater', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/careers/c2'), career()));
    await assertFails(setDoc(doc(alice(), 'users/alice/careers/c1'), { ...career(), ownerUid: 'bob' }));
  });

  it('outro usuário não acessa', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice/careers/c1'), career()));
    await assertFails(getDoc(doc(bob(), 'users/alice/careers/c1')));
    await assertFails(setDoc(doc(bob(), 'users/alice/careers/c1'), career()));
    await assertFails(deleteDoc(doc(bob(), 'users/alice/careers/c1')));
  });

  it('caminhos fora de users/{uid} são negados', async () => {
    await assertFails(setDoc(doc(alice(), 'careers/c1'), career()));
    await assertFails(getDoc(doc(alice(), 'qualquer/coisa')));
  });
});

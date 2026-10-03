import { describe, expect, it } from 'vitest';
import { autoplayCareer } from '../engine/autoplay';
import { buildCareerSummary, sanitizeSummary } from '../engine/careerSummary';
import { hubCareer, profile } from '../engine/testUtils';
import { sanitizeCareer } from '../state/storage';
import { createFirebaseService } from './service';
import { CloudConflictError, CloudError } from './types';

// Serviço real do jogo (Auth + Firestore) contra o Emulator Suite (npm run test:cloud).
// Cada "aparelho" é uma instância separada do Firebase app.

const settings = {
  apiKey: 'demo-key',
  authDomain: 'demo-footrise.firebaseapp.com',
  projectId: 'demo-footrise',
  appId: 'demo-app',
  useEmulator: true,
  emulatorHost: '127.0.0.1',
};
let n = 0;
const device = () => createFirebaseService(settings, `device-${Date.now()}-${n++}`);
const email = () => `jogador${Date.now()}${n++}@footrise.dev`;

describe('conta', () => {
  it('cria conta com nome de usuário, perfil no Firestore e login/logout', async () => {
    const svc = device();
    const mail = email();
    const user = await svc.signUp('Craque10', mail, 'segredo123');
    expect(user).toMatchObject({ email: mail, username: 'Craque10' });
    const prof = await svc.getProfile(user.uid);
    expect(prof).toMatchObject({ uid: user.uid, username: 'Craque10', email: mail });
    expect(typeof prof!.createdAt).toBe('number');
    expect(Object.keys(prof!).sort()).toEqual(['createdAt', 'email', 'uid', 'username']);
    await svc.signOut();

    const again = await device().signIn(mail, 'segredo123');
    expect(again).toMatchObject({ uid: user.uid, username: 'Craque10' });
  });

  it('erros do Firebase viram mensagens amigáveis', async () => {
    const svc = device();
    const mail = email();
    await svc.signUp('Dup', mail, 'segredo123');
    await expect(device().signUp('Dup2', mail, 'segredo123')).rejects.toThrow('Já existe uma conta com este e-mail.');
    await expect(device().signIn(mail, 'errada')).rejects.toThrow('E-mail ou senha incorretos.');
    await expect(device().signUp('Fraca', email(), '123')).rejects.toBeInstanceOf(CloudError);
  });

  it('recuperação de senha é aceita pelo Firebase', async () => {
    const mail = email();
    await device().signUp('Esquecido', mail, 'segredo123');
    await expect(device().resetPassword(mail)).resolves.toBeUndefined();
  });
});

describe('carreira ativa na nuvem', () => {
  it('salva o estado completo e recupera exatamente igual em outro aparelho', async () => {
    const a = device();
    const mail = email();
    const user = await a.signUp('Viajante', mail, 'segredo123');
    const career = hubCareer('ATA', 7);
    await a.pushActive(user.uid, career, null);

    const b = device();
    await b.signIn(mail, 'segredo123');
    const got = await b.fetchActive(user.uid);
    expect(got?.version).toEqual({ careerId: career.id, updatedAt: career.updatedAt });
    expect(sanitizeCareer(got!.career)).toEqual(career);
  });

  it('não sobrescreve quando a nuvem mudou (conflito detectado na transação)', async () => {
    const a = device();
    const user = await a.signUp('Duplo', email(), 'segredo123');
    const v1 = hubCareer('MEI', 3);
    await a.pushActive(user.uid, v1, null);
    const v2 = { ...v1, updatedAt: v1.updatedAt + 1000, age: v1.age + 1 };
    await a.pushActive(user.uid, v2, { careerId: v1.id, updatedAt: v1.updatedAt });

    // Outro aparelho ainda acha que a nuvem está na v1: a gravação é recusada.
    const stale = { ...v1, updatedAt: v1.updatedAt + 500 };
    await expect(a.pushActive(user.uid, stale, { careerId: v1.id, updatedAt: v1.updatedAt })).rejects.toBeInstanceOf(CloudConflictError);
    expect((await a.fetchActive(user.uid))?.version.updatedAt).toBe(v2.updatedAt);

    // Remoção (aposentadoria) também exige a versão certa.
    await expect(a.pushActive(user.uid, null, { careerId: v1.id, updatedAt: v1.updatedAt })).rejects.toBeInstanceOf(CloudConflictError);
    await a.pushActive(user.uid, null, { careerId: v2.id, updatedAt: v2.updatedAt });
    expect(await a.fetchActive(user.uid)).toBeNull();
  });

  it('carreira grande (até a aposentadoria) cabe no documento', async () => {
    const a = device();
    const user = await a.signUp('Longevo', email(), 'segredo123');
    const full = autoplayCareer(profile('ATA', 'ENG', 16), 99);
    const asActive = { ...full, phase: 'hub' as const };
    await a.pushActive(user.uid, asActive, null);
    expect(sanitizeCareer((await a.fetchActive(user.uid))!.career)?.seasons).toHaveLength(full.seasons.length);
  });
});

describe('histórico na nuvem', () => {
  it('salva, lista e exclui carreiras encerradas da própria conta', async () => {
    const a = device();
    const user = await a.signUp('Lenda', email(), 'segredo123');
    const done = autoplayCareer(profile('PD', 'ARG'), 55, { retireAge: 35 });
    const summary = buildCareerSummary(done, 1000);
    await a.saveCareer(user.uid, summary);
    const list = (await a.listCareers(user.uid)).map(sanitizeSummary);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ ...summary, cloudUid: user.uid });
    await a.deleteCareer(user.uid, summary.careerId);
    expect(await a.listCareers(user.uid)).toHaveLength(0);
  });

  it('um usuário não lê nem grava os dados de outro', async () => {
    const a = device();
    const alice = await a.signUp('Alice', email(), 'segredo123');
    await a.pushActive(alice.uid, hubCareer('ATA', 1), null);
    const b = device();
    await b.signUp('Bob', email(), 'segredo123');
    await expect(b.fetchActive(alice.uid)).rejects.toBeInstanceOf(CloudError);
    await expect(b.listCareers(alice.uid)).rejects.toBeInstanceOf(CloudError);
    await expect(b.pushActive(alice.uid, hubCareer('ZAG', 2), null)).rejects.toBeDefined();
  });
});

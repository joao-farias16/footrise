import { describe, expect, it } from 'vitest';
import { autoplayCareer } from '../engine/autoplay';
import { chooseEventOption, continueAfterEvent, continueAfterReview, startSeason, stayAtClub } from '../engine/career';
import { hubCareer, profile } from '../engine/testUtils';
import { buildCareerSummary } from '../engine/careerSummary';
import {
  deleteCareerSummary,
  loadCareerHistory,
  loadCurrent,
  loadRetired,
  memoryStore,
  moveToRetired,
  sanitizeCareer,
  saveCareerSummary,
  saveCurrent,
  STORAGE_KEYS,
  type KeyValueStore,
} from './storage';

describe('persistência', () => {
  it('salva e carrega a carreira atual', () => {
    const store = memoryStore();
    const c = hubCareer('ATA', 4);
    expect(saveCurrent(store, c)).toBe(true);
    expect(loadCurrent(store)).toEqual(c);
    saveCurrent(store, null);
    expect(loadCurrent(store)).toBeNull();
  });

  it('storage vazio ou corrompido não quebra', () => {
    const store = memoryStore();
    expect(loadCurrent(store)).toBeNull();
    expect(loadCareerHistory(store)).toEqual([]);
    store.setItem(STORAGE_KEYS.current, '{isso não é json');
    store.setItem(STORAGE_KEYS.history, '"texto"');
    expect(loadCurrent(store)).toBeNull();
    expect(loadCareerHistory(store)).toEqual([]);
    expect(store.getItem(STORAGE_KEYS.current)).toBeNull();
    // O texto corrompido não é perdido: fica guardado à parte.
    expect(store.getItem(`${STORAGE_KEYS.quarantine}:${STORAGE_KEYS.current}`)).toBe('{isso não é json');
  });

  it('rejeita carreiras inválidas e repara estados intermediários', () => {
    expect(sanitizeCareer(null)).toBeNull();
    expect(sanitizeCareer({ id: 'x' })).toBeNull();
    const c = hubCareer('MEI', 2);
    expect(sanitizeCareer({ ...c, clubId: 'clube-inexistente' })).toBeNull();
    const repaired = sanitizeCareer({ ...c, phase: 'offers', offers: [] });
    expect(repaired?.phase).toBe('hub');
    const partial = { ...c } as Record<string, unknown>;
    delete partial.modifiers;
    delete partial.trophies;
    const fixed = sanitizeCareer(partial);
    expect(fixed?.modifiers.injuryRisk).toBe(1);
    expect(fixed?.trophies).toEqual([]);
  });

  it('salva, lista e exclui carreiras do histórico', () => {
    const store = memoryStore();
    const a = autoplayCareer(profile('ATA'), 10);
    const b = autoplayCareer(profile('ZAG'), 11);
    saveCareerSummary(store, buildCareerSummary(a, 1));
    saveCareerSummary(store, buildCareerSummary(b, 2));
    saveCareerSummary(store, buildCareerSummary(a, 3)); // salvar de novo não duplica
    expect(loadCareerHistory(store).map((s) => s.careerId).sort()).toEqual([a.id, b.id].sort());
    expect(deleteCareerSummary(store, a.id).history.map((s) => s.careerId)).toEqual([b.id]);
    expect(loadCareerHistory(store)).toHaveLength(1);
  });

  it('save inválido não é apagado: vai para quarentena', () => {
    const store = memoryStore();
    store.setItem(STORAGE_KEYS.current, JSON.stringify({ id: 'quebrado' }));
    expect(loadCurrent(store)).toBeNull();
    expect(store.getItem(`${STORAGE_KEYS.quarantine}:${STORAGE_KEYS.current}`)).toContain('quebrado');
  });

  it('aposentar tira a carreira do slot ativo, mas ela sobrevive ao recarregar até ser salva', () => {
    const store = memoryStore();
    const done = autoplayCareer(profile('MEI'), 21);
    saveCurrent(store, { ...done, phase: 'hub' });
    expect(moveToRetired(store, done)).toBe(true);
    expect(loadCurrent(store)).toBeNull();
    expect(loadRetired(store)?.id).toBe(done.id);
    // Uma segunda aposentadoria com a primeira ainda pendente: a primeira vai para o histórico (nada se perde).
    const other = autoplayCareer(profile('ZAG'), 22);
    expect(moveToRetired(store, other)).toBe(true);
    expect(loadRetired(store)?.id).toBe(other.id);
    expect(loadCareerHistory(store).map((s) => s.careerId)).toEqual([done.id]);
  });

  it('carreira aposentada antiga no slot ativo é movida para o slot de aposentada', () => {
    const store = memoryStore();
    const done = autoplayCareer(profile('ATA'), 23);
    store.setItem(STORAGE_KEYS.current, JSON.stringify(done));
    expect(loadCurrent(store)).toBeNull();
    expect(loadRetired(store)?.id).toBe(done.id);
    expect(store.getItem(STORAGE_KEYS.current)).toBeNull();
  });

  it('histórico do formato antigo (carreiras completas) é convertido em resumos', () => {
    const store = memoryStore();
    const a = autoplayCareer(profile('ATA'), 30);
    const b = autoplayCareer(profile('GOL'), 31);
    store.setItem(STORAGE_KEYS.history, JSON.stringify([a, b]));
    const list = loadCareerHistory(store);
    expect(list.map((s) => s.careerId).sort()).toEqual([a.id, b.id].sort());
    expect(store.getItem(STORAGE_KEYS.history)).toBeNull();
    expect(store.getItem(`${STORAGE_KEYS.quarantine}:${STORAGE_KEYS.history}`)).not.toBeNull();
    expect(loadCareerHistory(store)).toHaveLength(2);
  });

  it('continua funcionando se o storage lançar erros', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(loadCurrent(broken)).toBeNull();
    expect(saveCurrent(broken, hubCareer())).toBe(false);
    expect(loadCareerHistory(broken)).toEqual([]);
  });

  it('save de versão antiga com clubes fictícios é migrado para clubes reais', () => {
    const c = hubCareer('ATA', 4);
    const old = JSON.parse(JSON.stringify(c));
    old.clubId = 'kingsport-city';
    old.national = { caps: 3, goals: 1, tournaments: [] };
    old.seasons = [{ ...structuredClone(c.seasons[0] ?? {}), clubId: 'brava-cf', clubName: 'Brava CF', trophies: [], national: { calledUp: true, caps: 3, goals: 1 } }];
    old.transfers = [{ season: '2027/28', fromClubId: 'guanabara-fc', toClubId: 'kingsport-city', fee: 1, kind: 'transfer' }];
    old.trophies = [{ kind: 'league', name: 'Liga Inglesa', season: '2027/28', team: 'Kingsport City' }];
    const fixed = sanitizeCareer(old);
    expect(fixed).not.toBeNull();
    expect(fixed!.clubId).toBe('manchester-city');
    expect(fixed!.seasons[0].clubId).toBe('barcelona');
    expect(fixed!.seasons[0].clubName).toBe('Barcelona');
    expect(fixed!.transfers[0]).toMatchObject({ fromClubId: 'flamengo', toClubId: 'manchester-city' });
    expect(fixed!.trophies[0].team).toBe('Manchester City');
    expect(fixed!.national.callups).toBe(1);
    expect(fixed!.national.qualifiers).toEqual([]);
  });

  it('carreira com seleção, estatísticas detalhadas e eliminatórias sobrevive ao recarregar', () => {
    const store = memoryStore();
    const done = autoplayCareer(profile('ATA', 'ENG'), 12, { retireAge: 34 });
    const summary = buildCareerSummary(done, 5);
    saveCareerSummary(store, summary);
    const back = loadCareerHistory(store)[0];
    expect(back).toEqual(summary);
    expect(back.legacy).toEqual(done.legacy);

    // Carreira em andamento, no meio de um ciclo de eliminatórias.
    let c = hubCareer('MEI', 6);
    for (let i = 0; i < 30 && c.seasons.length < 2; i++) {
      if (c.phase === 'hub') c = startSeason(c);
      else if (c.phase === 'event') c = c.events[c.eventIndex].resolved ? continueAfterEvent(c) : chooseEventOption(c, 0);
      else if (c.phase === 'season-review') c = continueAfterReview(c);
      else if (c.phase === 'offers') c = stayAtClub(c);
    }
    saveCurrent(store, c);
    expect(loadCurrent(store)).toEqual(c);
  });
});

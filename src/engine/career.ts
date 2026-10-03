import { CAREER, REPUTATION } from '../config/balance';
import { getClub, getLeague } from '../data/clubs';
import type { Career, DraftMode, PlayerProfile, SeasonRecord } from '../types';
import { applyDraftPick, createDraft, finalizeDraft, isDraftComplete, repairDraft, rerollDraftRound } from './draft';
import { defaultModifiers, resolveEventChoice, rollSeasonEvents } from './events';
import { evolveAttributes, initialAttributes } from './evolution';
import { computeLegacy, legacyInputFromCareer } from './legacy';
import { marketValue } from './market';
import { initialOffers, seasonOffers } from './offers';
import { computeOverall } from './overall';
import { Rng, clamp, randomSeed } from './rng';
import { assignClubNumber, assignNationalNumber, currentShirtNumber } from './shirt';
import { getCountry } from '../data/countries';
import { initialContinentalQualification, seasonLabel, simulateSeason } from './season';

/**
 * Cada transição recebe uma carreira e devolve uma NOVA carreira.
 * O estado do RNG é salvo junto, então tudo é reproduzível a partir da seed.
 */
function step(career: Career, fn: (c: Career, rng: Rng) => void): Career {
  const next = structuredClone(career);
  const rng = new Rng(next.rngState);
  fn(next, rng);
  next.rngState = rng.state;
  next.updatedAt = Date.now();
  return next;
}

export function currentOverall(c: Career): number {
  return computeOverall(c.attributes, c.position);
}

export function potentialOverall(c: Career): number {
  return computeOverall(c.potential, c.position);
}

export function createCareer(profile: PlayerProfile, mode: DraftMode, seed = randomSeed()): Career {
  const rng = new Rng(seed);
  const draft = createDraft(profile.position, rng);
  const now = Date.now();
  return {
    version: CAREER.saveVersion,
    id: `c-${now.toString(36)}-${seed.toString(36)}`,
    seed,
    rngState: rng.state,
    createdAt: now,
    updatedAt: now,
    mode,
    profile,
    phase: 'draft',
    draft,
    potential: {},
    attributes: {},
    sources: {},
    position: profile.position,
    age: profile.startAge,
    year: CAREER.firstSeasonYear,
    clubId: null,
    parentClubId: null,
    weeklyWage: 0,
    reputation: REPUTATION.start,
    morale: 60,
    coachTrust: 50,
    continentalQualified: false,
    lastLeaguePos: null,
    seasons: [],
    trophies: [],
    awards: [],
    transfers: [],
    national: { caps: 0, goals: 0, tournaments: [], callups: 0, starts: 0, assists: 0, qualifiers: [] },
    offers: [],
    events: [],
    eventIndex: 0,
    modifiers: defaultModifiers(),
    promisedClubId: null,
    retireAnnounced: false,
    forcedRetirementReason: null,
    peakOvr: 0,
    peakValue: 0,
    totalEarnings: 0,
    legacy: null,
    shirtNumbers: [],
  };
}

export function draftPick(career: Career, optionIndex: number): Career {
  if (career.phase !== 'draft') return career;
  return step(career, (c, rng) => {
    c.draft = applyDraftPick(c.draft, c.profile.position, optionIndex, rng);
    if (isDraftComplete(c.draft)) finishDraft(c, rng);
  });
}

function finishDraft(c: Career, rng: Rng): void {
  const { potential, sources } = finalizeDraft(c.draft, c.profile.position, rng);
  c.potential = potential;
  c.sources = sources;
  c.attributes = initialAttributes(potential, c.profile.position, c.age, rng);
  c.peakOvr = currentOverall(c);
  c.phase = 'card';
}

/** Ajusta drafts salvos por versões antigas às regras atuais (6 escolhas, atributos bloqueados). */
export function repairDraftCareer(career: Career): Career {
  if (career.phase !== 'draft') return career;
  const rng = new Rng(career.rngState);
  const draft = repairDraft(career.draft, career.profile.position, rng);
  if (draft === career.draft) return career;
  return step(career, (c, stepRng) => {
    c.draft = repairDraft(c.draft, c.profile.position, stepRng);
    if (isDraftComplete(c.draft)) finishDraft(c, stepRng);
  });
}

export function draftReroll(career: Career): Career {
  if (career.phase !== 'draft' || career.draft.rerollUsed || !career.draft.current) return career;
  return step(career, (c, rng) => {
    c.draft = rerollDraftRound(c.draft, c.profile.position, rng);
  });
}

export function goToClubChoice(career: Career): Career {
  if (career.phase !== 'card') return career;
  return step(career, (c, rng) => {
    c.offers = initialOffers(c, rng);
    c.phase = 'club-choice';
  });
}

export function chooseInitialClub(career: Career, offerId: string): Career {
  if (career.phase !== 'club-choice') return career;
  const offer = career.offers.find((o) => o.id === offerId);
  const club = getClub(offer?.clubId);
  if (!offer || !club) return career;
  return step(career, (c, rng) => {
    c.clubId = club.id;
    c.weeklyWage = offer.weeklyWage;
    assignClubNumber(c, club.id, club.name, seasonLabel(c.year), rng);
    c.continentalQualified = initialContinentalQualification(club);
    c.offers = [];
    c.phase = 'hub';
  });
}

/** Começa a temporada: sorteia eventos ou simula direto. */
export function startSeason(career: Career): Career {
  if (career.phase !== 'hub') return career;
  return step(career, (c, rng) => {
    c.modifiers = defaultModifiers();
    c.events = rollSeasonEvents(c, rng);
    c.eventIndex = 0;
    if (c.events.length > 0) c.phase = 'event';
    else runSeason(c, rng);
  });
}

export function chooseEventOption(career: Career, choiceIndex: number): Career {
  if (career.phase !== 'event') return career;
  return step(career, (c, rng) => {
    const instance = c.events[c.eventIndex];
    if (!instance || instance.resolved) return;
    c.events[c.eventIndex] = resolveEventChoice(c, instance, choiceIndex, rng);
  });
}

export function continueAfterEvent(career: Career): Career {
  if (career.phase !== 'event') return career;
  return step(career, (c, rng) => {
    const instance = c.events[c.eventIndex];
    if (instance && !instance.resolved) return;
    c.eventIndex++;
    if (c.eventIndex >= c.events.length) runSeason(c, rng);
  });
}

function bestSeasonBy(seasons: SeasonRecord[], f: (s: SeasonRecord) => number): number {
  return seasons.reduce((m, s) => Math.max(m, f(s)), 0);
}

/** Simula a temporada e aplica todas as consequências (muta `c`). */
function runSeason(c: Career, rng: Rng): void {
  const out = simulateSeason(c, rng);
  const rec = out.record;
  const club = getClub(c.clubId)!;
  const league = getLeague(club.leagueId);
  const prevSeasons = [...c.seasons];
  const prevCaps = c.national.caps;

  // Evolução
  const evo = evolveAttributes(
    {
      attributes: c.attributes,
      potential: c.potential,
      position: c.position,
      age: c.age,
      minutes: rec.minutes,
      rating: rec.rating,
      leagueStrength: league.strength,
    },
    rng,
  );
  c.attributes = evo.attributes;
  rec.attrDelta = evo.delta;
  rec.ovrEnd = currentOverall(c);

  // Reputação, moral e confiança
  const minutesShare = Math.min(1, rec.minutes / 3000);
  let rep = c.reputation - REPUTATION.decayPerSeason;
  rep += rec.apps > 0 ? (rec.rating - 6.6) * REPUTATION.ratingWeight * (0.4 + minutesShare) : -5;
  rep += minutesShare * (league.strength - 65) * REPUTATION.leagueExposureWeight;
  for (const t of rec.trophies) rep += REPUTATION.trophy[t.kind] ?? REPUTATION.bigTitleBonus;
  for (const a of rec.awards) {
    rep += a.kind === 'world' ? REPUTATION.worldAwardBonus : a.kind === 'tournamentBest' ? REPUTATION.tournamentAwardBonus : REPUTATION.awardBonus;
  }
  // Seleção: convocações, produção e vitrine dos grandes torneios.
  const nat = rec.national;
  if (nat.calledUp) {
    rep += Math.min(REPUTATION.callupCap, (nat.callups ?? 1) * REPUTATION.perCallup);
    rep += Math.min(REPUTATION.natProductionCap, nat.goals * REPUTATION.natGoalWeight + (nat.assists ?? 0) * REPUTATION.natAssistWeight);
    if (nat.competitions?.some((comp) => comp.kind === 'worldCup' && comp.inSquad && comp.caps > 0)) rep += REPUTATION.worldCupSquad;
  }
  c.reputation = clamp(Math.round(rep), 0, REPUTATION.max);

  const playedShare = rec.apps > 0 ? rec.starts / Math.max(rec.apps, 25) : 0;
  c.morale = clamp(Math.round(c.morale + (rec.rating > 0 ? (rec.rating - 6.7) * 12 : -10) + (playedShare - 0.5) * 16), 5, 95);
  c.morale = Math.round(c.morale * 0.8 + 55 * 0.2);
  c.coachTrust = clamp(Math.round(c.coachTrust + (rec.rating > 0 ? (rec.rating - 6.7) * 10 : -4)), 5, 95);
  c.coachTrust = Math.round(c.coachTrust * 0.9 + 50 * 0.1);

  // Mercado e finanças
  rec.marketValue = marketValue(rec.ovrEnd, c.age + 1, c.reputation);
  c.peakValue = Math.max(c.peakValue, rec.marketValue);
  c.peakOvr = Math.max(c.peakOvr, rec.ovrEnd, rec.ovrStart);
  c.totalEarnings += c.weeklyWage * 52;

  rec.shirtNumber = currentShirtNumber(c);

  // Seleção
  if (nat.calledUp) {
    assignNationalNumber(c, getCountry(c.profile.nationality).name, rec.season, rng);
    c.national.caps += nat.caps;
    c.national.goals += nat.goals;
    c.national.callups = (c.national.callups ?? 0) + (nat.callups ?? 1);
    c.national.starts = (c.national.starts ?? 0) + (nat.starts ?? 0);
    c.national.assists = (c.national.assists ?? 0) + (nat.assists ?? 0);
    if (!c.national.debutSeason && nat.caps > 0) c.national.debutSeason = rec.season;
  }
  for (const comp of nat.competitions ?? []) {
    if ((comp.kind === 'worldCup' || comp.kind === 'continental') && comp.inSquad) {
      c.national.tournaments.push({ season: rec.season, name: comp.name, result: comp.result });
    }
  }
  c.national.qualifiers = out.nationalQualifiers;

  c.trophies.push(...rec.trophies);
  c.awards.push(...rec.awards);
  c.continentalQualified = out.continentalQualified;
  c.lastLeaguePos = out.leaguePos;

  rec.headlines = buildHeadlines(rec, prevSeasons, prevCaps, c);
  c.seasons.push(rec);

  // Aposentadoria obrigatória ao atingir a idade máxima (34–39 a escolha é do jogador).
  const nextAge = c.age + 1;
  if (nextAge >= CAREER.maxAge) c.forcedRetirementReason = `Aos ${CAREER.maxAge} anos, a aposentadoria é obrigatória. Hora de pendurar as chuteiras.`;

  c.phase = 'season-review';
}

function buildHeadlines(rec: SeasonRecord, prev: SeasonRecord[], prevCaps: number, c: Career): string[] {
  const h: string[] = [];
  for (const t of rec.trophies) h.push(`🏆 Campeão: ${t.name}`);
  for (const a of rec.awards) h.push(`🥇 ${a.name}`);
  const nat = rec.national;
  if (nat.calledUp && prevCaps === 0 && nat.caps > 0) h.push('🌍 Estreia pela seleção principal!');
  else if (nat.calledUp && prevCaps === 0) h.push('🌍 Primeira convocação para a seleção!');
  for (const comp of nat.competitions ?? []) {
    if ((comp.kind === 'worldCup' || comp.kind === 'continental') && comp.inSquad && !comp.won) {
      h.push(`🌍 ${comp.name}: ${comp.result}${comp.goals > 0 ? ` · ${comp.goals} gol${comp.goals > 1 ? 's' : ''}` : ''}`);
    }
  }
  if (nat.goals >= 5) h.push(`⚽ ${nat.goals} gols pela seleção na temporada`);
  if (!nat.calledUp && (nat.missedInjured ?? 0) > 0 && prevCaps > 0) h.push('🩹 A lesão tirou você das convocações da seleção');
  const caps = c.national.caps;
  for (const milestone of [50, 100, 150]) {
    if (prevCaps < milestone && caps >= milestone) h.push(`🎖️ ${milestone} jogos pela seleção!`);
  }
  if (prev.length > 0 && rec.goals > 0 && rec.goals > bestSeasonBy(prev, (s) => s.goals)) h.push(`⚽ Recorde pessoal: ${rec.goals} gols na temporada`);
  if (prev.length > 0 && rec.assists > 0 && rec.assists > bestSeasonBy(prev, (s) => s.assists)) h.push(`🎯 Recorde pessoal: ${rec.assists} assistências`);
  if (prev.length > 0 && rec.rating >= 7 && rec.rating > bestSeasonBy(prev, (s) => s.rating)) h.push(`⭐ Melhor nota média da carreira: ${rec.rating.toFixed(2)}`);
  const diff = rec.ovrEnd - rec.ovrStart;
  if (diff >= 3) h.push(`📈 Evolução forte: OVR ${rec.ovrStart} → ${rec.ovrEnd}`);
  if (diff <= -3) h.push(`📉 O tempo pesa: OVR ${rec.ovrStart} → ${rec.ovrEnd}`);
  if (rec.ovrEnd >= c.peakOvr && rec.ovrEnd > rec.ovrStart && prev.length > 0) h.push(`🔝 Novo pico de carreira: ${rec.ovrEnd} OVR`);
  const serious = rec.injuries.find((i) => i.games >= 12);
  if (serious) h.push(`🩹 ${serious.label}: ${serious.games} jogos fora`);
  return h;
}

/** Depois do resumo: aposentadoria ou janela de transferências. */
export function continueAfterReview(career: Career): Career {
  if (career.phase !== 'season-review') return career;
  return step(career, (c, rng) => {
    if (c.retireAnnounced || c.forcedRetirementReason) {
      // A carreira termina ao fim da temporada: o jogador já tem a idade seguinte.
      c.age++;
      retire(c);
      return;
    }
    c.age++;
    c.year++;
    c.events = [];
    c.eventIndex = 0;
    c.modifiers = defaultModifiers();

    const last = c.seasons[c.seasons.length - 1];
    // Fim de empréstimo: volta ao clube dono do passe.
    if (c.parentClubId) {
      const parent = getClub(c.parentClubId);
      c.clubId = c.parentClubId;
      c.parentClubId = null;
      c.coachTrust = 50;
      if (parent) {
        c.continentalQualified = initialContinentalQualification(parent);
        assignClubNumber(c, parent.id, parent.name, seasonLabel(c.year), rng);
      }
    }
    c.offers = seasonOffers(c, last, rng);
    c.promisedClubId = null;
    c.phase = c.offers.length > 0 ? 'offers' : 'hub';
  });
}

export function acceptOffer(career: Career, offerId: string): Career {
  if (career.phase !== 'offers') return career;
  const offer = career.offers.find((o) => o.id === offerId);
  const club = getClub(offer?.clubId);
  if (!offer || !club) return career;
  return step(career, (c, rng) => {
    c.transfers.push({ season: seasonLabel(c.year), fromClubId: c.clubId ?? '', toClubId: club.id, fee: offer.fee, kind: offer.kind });
    assignClubNumber(c, club.id, club.name, seasonLabel(c.year), rng);
    if (offer.kind === 'loan') {
      c.parentClubId = c.clubId;
    } else {
      c.parentClubId = null;
      c.weeklyWage = offer.weeklyWage;
    }
    c.clubId = club.id;
    c.coachTrust = 50;
    c.morale = clamp(c.morale + 5, 0, 100);
    c.continentalQualified = initialContinentalQualification(club);
    c.offers = [];
    c.phase = 'hub';
  });
}

export function stayAtClub(career: Career): Career {
  if (career.phase !== 'offers') return career;
  return step(career, (c) => {
    c.offers = [];
    c.phase = 'hub';
  });
}

export function announceRetirement(career: Career, value = true): Career {
  if (career.phase !== 'hub' || career.age < CAREER.canRetireAge) return career;
  return step(career, (c) => {
    c.retireAnnounced = value;
  });
}

/** Aposenta imediatamente (a partir do hub). */
export function retireNow(career: Career): Career {
  if (career.phase !== 'hub' || career.age < CAREER.canRetireAge || career.seasons.length === 0) return career;
  return step(career, (c) => retire(c));
}

function retire(c: Career): void {
  c.legacy = computeLegacy(legacyInputFromCareer(c));
  c.offers = [];
  c.events = [];
  c.eventIndex = 0;
  c.retireAnnounced = false;
  c.retirementAge = c.age;
  c.retiredAt = Date.now();
  c.phase = 'retired';
}

/** 34–39 anos: aposentadoria opcional (exige ao menos uma temporada jogada). */
export function canRetire(c: Career): boolean {
  return c.phase === 'hub' && c.age >= CAREER.canRetireAge && c.age < CAREER.maxAge && c.seasons.length > 0;
}

/** Temporada atual é a última possível (a seguinte já seria na idade máxima). */
export function isFinalAllowedSeason(c: Career): boolean {
  return c.age + 1 >= CAREER.maxAge;
}

import { CAREER, OFFERS, TWILIGHT } from '../config/balance';
import { CLUBS, clubsOfCountry, getClub, getLeague } from '../data/clubs';
import { getCountry } from '../data/countries';
import type { Career, Club, Offer, OfferKind, PositionId, SeasonRecord } from '../types';
import { expectedStartShare, marketValue, transferFee, weeklyWage } from './market';
import { computeOverall } from './overall';
import { clamp, type Rng } from './rng';

function offerId(rng: Rng): string {
  return `of-${Math.floor(rng.next() * 1e12).toString(36)}`;
}

/** Escolhe um clube com força próxima do alvo, evitando os já usados. */
export function pickClubNear(target: number, rng: Rng, exclude: Set<string>, filter?: (c: Club) => boolean): Club | undefined {
  const candidates = CLUBS.filter((c) => !exclude.has(c.id) && (!filter || filter(c)));
  if (candidates.length === 0) return undefined;
  return rng.weighted(candidates, (c) => Math.exp(-Math.abs(c.strength - target) / 2.2));
}

export function buildOffer(
  club: Club,
  kind: OfferKind,
  ovr: number,
  age: number,
  reputation: number,
  rng: Rng,
  pitch: string,
  position?: PositionId,
): Offer {
  const league = getLeague(club.leagueId);
  const wage = weeklyWage(ovr, reputation, league.wageLevel) * (kind === 'loan' ? 1 : rng.range(1, 1.3));
  const fee = kind === 'transfer' ? transferFee(marketValue(ovr, age, reputation), club, rng) : 0;
  return {
    id: offerId(rng),
    kind,
    clubId: club.id,
    weeklyWage: Math.round(wage / 500) * 500,
    fee: Math.round(fee / 100_000) * 100_000,
    startShare: expectedStartShare(ovr, club.strength, 50, position),
    big: false,
    pitch,
  };
}

function describeOffer(club: Club, ovr: number, current?: Club, position?: PositionId): string {
  const share = expectedStartShare(ovr, club.strength, 50, position);
  const league = getLeague(club.leagueId);
  if (league.wageLevel >= 1.8) return 'Salário altíssimo, mas pouca vitrine.';
  if (current && club.strength >= current.strength + OFFERS.bigClubGap) return 'Um gigante quer você. Mais títulos, mais disputa por posição.';
  if (club.reputation >= 88) return 'Clube de elite: pressão máxima e vitrine mundial.';
  if (share >= 0.8) return 'Projeto para ser titular absoluto e protagonista.';
  if (share < 0.4) return 'Elenco forte: você chega para brigar por espaço.';
  return 'Equilíbrio entre minutos e ambição.';
}

function initialPitch(share: number): string {
  if (share >= 0.75) return 'Titular desde o primeiro dia. Minutos garantem evolução.';
  if (share >= 0.4) return 'Disputa saudável por posição em um clube competitivo.';
  return 'Clube grande, mais salário e vitrine. Mas o banco é real.';
}

/**
 * Clubes elegíveis para o primeiro contrato: sempre do país do jogador.
 * Só se o país tivesse menos de 3 clubes cadastrados é que a busca se estenderia
 * à mesma confederação (não acontece com os países selecionáveis).
 */
export function initialClubPool(nationality: string): Club[] {
  const home = clubsOfCountry(nationality);
  if (home.length >= 3) return home;
  const confed = getCountry(nationality).confed;
  const near = CLUBS.filter((c) => !home.includes(c) && getCountry(c.country).confed === confed);
  return [...home, ...near];
}

/**
 * Três propostas iniciais de clubes do país do jogador, com perfis distintos:
 * opção segura (protagonismo), intermediária (equilíbrio) e ambiciosa (vitrine).
 */
export function initialOffers(career: Career, rng: Rng): Offer[] {
  const ovr = computeOverall(career.attributes, career.position);
  const pool = initialClubPool(career.profile.nationality);
  const inPool = new Set(pool.map((c) => c.id));
  const used = new Set<string>();
  const targets = [ovr - rng.range(4, 8), ovr + rng.range(0, 3), ovr + rng.range(9, 14)];
  const clubs = targets.map((target) => {
    const club = pickClubNear(target, rng, used, (c) => inPool.has(c.id)) ?? pool[0] ?? CLUBS[0];
    used.add(club.id);
    return club;
  });
  // Ordena do mais seguro (mais fraco) ao mais ambicioso (mais forte).
  clubs.sort((a, b) => a.strength - b.strength || a.reputation - b.reputation);
  return clubs.map((club) =>
    buildOffer(
      club,
      'initial',
      ovr,
      career.age,
      career.reputation,
      rng,
      initialPitch(expectedStartShare(ovr, club.strength, 50, career.position)),
      career.position,
    ),
  );
}

/**
 * Clube onde o jogador surgiu: o do primeiro contrato. A primeira transferência sai dele;
 * sem transferências, é o clube da primeira temporada (ou o atual, antes de jogar).
 */
export function originClubId(c: Career): string | null {
  return getClub(c.transfers[0]?.fromClubId)?.id ?? getClub(c.seasons[0]?.clubId)?.id ?? getClub(c.clubId)?.id ?? null;
}

/**
 * Quanto o jogador já está no declínio da carreira (0–1), a partir do que a simulação registra:
 * idade, distância para o pico de OVR, queda de OVR na última temporada e nota. A idade sozinha
 * não basta — um veterano que ainda mantém o nível segue com o mercado normal.
 */
export function declineFactor(c: Career, last: Pick<SeasonRecord, 'rating' | 'apps'> & Partial<SeasonRecord>, ovr = computeOverall(c.attributes, c.position)): number {
  const ageGate = clamp((c.age - TWILIGHT.fromAge) / TWILIGHT.ageSpan, 0, 1);
  if (ageGate === 0) return 0;
  const fromPeak = clamp((Math.max(c.peakOvr, ovr) - ovr) / TWILIGHT.peakDropFull, 0, 1);
  const trend = Number.isFinite(last.ovrStart) && Number.isFinite(last.ovrEnd) ? (last.ovrStart as number) - (last.ovrEnd as number) : 0;
  const falling = clamp(trend / TWILIGHT.seasonDropFull, 0, 1);
  // Sem nenhuma perda de OVR ainda não é declínio (nota ruim sozinha é só uma temporada ruim).
  if (fromPeak === 0 && falling === 0) return 0;
  const lowForm = last.apps > 0 ? clamp((6.9 - last.rating) / 0.6, 0, 1) : 1;
  const signal = clamp(fromPeak * 0.5 + falling * 0.35 + lowForm * 0.15, 0, 1);
  return Math.round(ageGate * signal * 100) / 100;
}

/** Propostas de fim de temporada, baseadas em desempenho e reputação. */
export function seasonOffers(career: Career, last: SeasonRecord, rng: Rng): Offer[] {
  const ovr = computeOverall(career.attributes, career.position);
  const current = getClub(career.clubId);
  const parent = getClub(career.parentClubId);
  const exclude = new Set<string>([career.clubId ?? '', career.parentClubId ?? '']);
  const offers: Offer[] = [];
  const perf = last.apps > 0 ? last.rating - 6.8 : -0.5;

  if (ovr < CAREER.lowOvrRetire && career.age >= CAREER.lowOvrAge) return [];

  let count = 1 + (perf > 0.3 ? 1 : 0) + (perf > 0.7 ? 1 : 0) + (rng.chance(0.4) ? 1 : 0);
  if (career.age >= 33) count -= 1;
  count = clamp(count, 0, OFFERS.maxOffers);

  // Fim de carreira: clubes do país do jogador (e o que o revelou) passam a se interessar mais.
  // Só consome o RNG quando há declínio, então o mercado de jovens e de jogadores no auge não muda.
  const decline = declineFactor(career, last, ovr);
  const homeIds = decline > 0 ? new Set(initialClubPool(career.profile.nationality).map((c) => c.id)) : null;
  const abroad = !!current && !homeIds?.has(current.id);

  const ambition = clamp(perf * 7 + career.reputation / 22 - 1, -6, 9);
  for (let i = 0; i < count; i++) {
    const target = ovr + rng.range(-7, 2) + ambition * rng.range(0.4, 1);
    // Parte das vagas pode vir de um clube do país, desde que o nível seja compatível com o alvo.
    const national =
      homeIds && rng.chance(decline * TWILIGHT.nationalShare)
        ? pickClubNear(target, rng, exclude, (c) => homeIds.has(c.id) && Math.abs(c.strength - target) <= TWILIGHT.nationalStrengthWindow)
        : undefined;
    const club = national ?? pickClubNear(target, rng, exclude);
    if (!club) break;
    exclude.add(club.id);
    const pitch = national && abroad ? 'Um clube do seu país quer você de volta em casa.' : describeOffer(club, ovr, current, career.position);
    offers.push(buildOffer(club, 'transfer', ovr, career.age, career.reputation, rng, pitch, career.position));
  }

  // O clube onde o jogador surgiu pode tentar trazê-lo de volta (nunca é garantido).
  const origin = decline > 0 ? getClub(originClubId(career)) : undefined;
  if (origin && !exclude.has(origin.id)) {
    const gap = Math.max(0, Math.abs(origin.strength - ovr) - TWILIGHT.originStrengthSlack);
    const chance = decline * TWILIGHT.originChance * Math.exp(-gap / TWILIGHT.originStrengthSlack);
    if (rng.chance(chance)) {
      exclude.add(origin.id);
      offers.unshift(buildOffer(origin, 'transfer', ovr, career.age, career.reputation, rng, 'O clube que te revelou quer você de volta para fechar o ciclo.', career.position));
    }
  }

  // Promessa de interesse feita durante um evento.
  if (career.promisedClubId && !exclude.has(career.promisedClubId)) {
    const club = getClub(career.promisedClubId);
    if (club) offers.unshift(buildOffer(club, 'transfer', ovr, career.age, career.reputation, rng, 'O clube que vinha te observando fez a proposta prometida.', career.position));
  }

  // Empréstimo para jovens com pouco espaço.
  const home = parent ?? current;
  if (home && career.age <= OFFERS.loanMaxAge && expectedStartShare(ovr, home.strength, career.coachTrust, career.position) < OFFERS.loanStartShareBelow) {
    const club = pickClubNear(ovr - 5, rng, exclude);
    if (club) offers.push(buildOffer(club, 'loan', ovr, career.age, career.reputation, rng, 'Empréstimo de 1 temporada para ganhar minutos e voltar mais forte.', career.position));
  }

  const ref = home ?? current;
  for (const o of offers) {
    const c = getClub(o.clubId);
    o.big = !!c && !!ref && (c.strength >= ref.strength + OFFERS.bigClubGap || (c.reputation >= 90 && ref.reputation < 85));
  }
  return offers.slice(0, OFFERS.maxOffers + 1);
}

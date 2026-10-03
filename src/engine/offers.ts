import { CAREER, MARKET, OFFERS } from '../config/balance';
import { CLUBS, clubsOfCountry, getClub, getLeague } from '../data/clubs';
import { getCountry } from '../data/countries';
import type { Career, Club, Offer, OfferKind, PositionId, SeasonRecord } from '../types';
import { expectedStartShare, marketValue, weeklyWage } from './market';
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
  const fee = kind === 'transfer' ? marketValue(ovr, age, reputation) * MARKET.feeMultiplier * rng.range(0.85, 1.25) : 0;
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

  const ambition = clamp(perf * 7 + career.reputation / 22 - 1, -6, 9);
  for (let i = 0; i < count; i++) {
    const target = ovr + rng.range(-7, 2) + ambition * rng.range(0.4, 1);
    const club = pickClubNear(target, rng, exclude);
    if (!club) break;
    exclude.add(club.id);
    offers.push(buildOffer(club, 'transfer', ovr, career.age, career.reputation, rng, describeOffer(club, ovr, current, career.position), career.position));
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

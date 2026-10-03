// Tipos de domínio compartilhados por dados, motor, estado e interface.

export type OutfieldAttr = 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
export type KeeperAttr = 'div' | 'han' | 'ref' | 'gkp' | 'kic' | 'phy';
export type AttrKey = OutfieldAttr | KeeperAttr;

/** Atributos de um jogador. Cada posição usa apenas 6 chaves (ver config/positions). */
export type Attributes = Partial<Record<AttrKey, number>>;

export type PositionId = 'GOL' | 'LD' | 'LE' | 'ZAG' | 'VOL' | 'MEI' | 'PD' | 'PE' | 'ATA';
export type Foot = 'D' | 'E';
export type DraftMode = 'analyst' | 'instinct';
export type Continent = 'EUR' | 'AMS' | 'ASI' | 'AFR' | 'NCA';
export type Confederation = 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF';

export interface Country {
  code: string;
  name: string;
  /** Força da seleção (0–100). */
  strength: number;
  confed: Confederation;
  /** Cores para a bandeira estilizada (faixas). */
  flag: string[];
  flagDir?: 'h' | 'v';
}

export interface Legend {
  id: string;
  name: string;
  country: string;
  position: PositionId;
  era: string;
  stats: Attributes;
  style: string;
}

export interface League {
  id: string;
  name: string;
  country: string;
  strength: number;
  games: number;
  continent: Continent;
  continentalSpots: number;
  wageLevel: number;
  /** Gols típicos do artilheiro da liga. */
  topScorerGoals: number;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  leagueId: string;
  strength: number;
  reputation: number;
  colors: [string, string];
  /** País do clube (normalmente o da liga; ex.: clubes canadenses na liga norte-americana). */
  country: string;
}

export interface PlayerProfile {
  name: string;
  nationality: string;
  startAge: number;
  position: PositionId;
  foot: Foot;
  number: number;
}

// ---------- Draft ----------

export interface DraftSlot {
  value: number;
  /** id da lenda ou 'academy' para atributos não draftados. */
  source: string;
}

export interface DraftOption {
  legendId: string;
  attr: AttrKey;
  value: number;
}

export interface DraftRound {
  legendIds: string[];
  options: DraftOption[];
}

export interface DraftPickRecord {
  round: number;
  legendId: string;
  attr: AttrKey;
  value: number;
  replaced?: DraftSlot;
}

export interface DraftState {
  round: number;
  totalRounds: number;
  current: DraftRound | null;
  slots: Partial<Record<AttrKey, DraftSlot>>;
  picks: DraftPickRecord[];
  usedLegends: string[];
  /** Reroll (1 por carreira) já usado. Ausente em saves antigos = disponível. */
  rerollUsed?: boolean;
}

// ---------- Ofertas / clubes ----------

export type OfferKind = 'initial' | 'transfer' | 'loan';

export interface Offer {
  id: string;
  kind: OfferKind;
  clubId: string;
  weeklyWage: number;
  fee: number;
  startShare: number;
  big: boolean;
  /** Texto curto que explica o perfil da proposta. */
  pitch: string;
}

// ---------- Eventos ----------

export interface SeasonModifiers {
  startShare: number;
  form: number;
  injuryRisk: number;
  goalBonus: number;
  callup: number;
  preseasonInjuryGames: number;
}

export interface EventInstance {
  defId: string;
  params: Record<string, string | number>;
  resolved?: { choiceIndex: number; text: string; tags: string[] };
}

// ---------- Temporada ----------

export type TrophyKind =
  | 'league'
  | 'cup'
  | 'continental'
  | 'clubWorld'
  | 'worldCup'
  | 'continentalNation'
  | 'nationsLeague';

export interface Trophy {
  kind: TrophyKind;
  name: string;
  season: string;
  team: string;
}

export type AwardKind =
  | 'topScorer'
  | 'bestYoung'
  | 'clubPlayer'
  | 'leaguePlayer'
  | 'bestKeeper'
  | 'world'
  | 'tournamentBest'
  | 'tournamentTopScorer';

export interface Award {
  kind: AwardKind;
  name: string;
  season: string;
}

export interface CompetitionResult {
  name: string;
  /** Texto curto: "Campeão", "Semifinal", "3º lugar" ... */
  result: string;
  won: boolean;
}

export interface NationalSeason {
  calledUp: boolean;
  caps: number;
  goals: number;
  /** Torneio principal (Copa do Mundo / continental) — mantido para compatibilidade. */
  tournament?: CompetitionResult;
  /** Janelas em que foi convocado / janelas disputadas pela seleção. */
  callups?: number;
  windows?: number;
  starts?: number;
  assists?: number;
  minutes?: number;
  rating?: number;
  /** Ficou fora de alguma convocação por lesão. */
  missedInjured?: number;
  /** Campanhas da seleção na temporada (eliminatórias, Nations League, torneios). */
  competitions?: NationalCompetition[];
}

export interface NationalCompetition {
  name: string;
  kind: 'friendly' | 'qualifier' | 'nationsLeague' | 'continental' | 'worldCup';
  result: string;
  won: boolean;
  /** O jogador fez parte do elenco (para títulos/participações). */
  inSquad: boolean;
  caps: number;
  goals: number;
  assists: number;
}

/** Estatísticas detalhadas da temporada (ausentes em saves antigos). */
export interface DetailStats {
  shots: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  saves: number;
  conceded: number;
}

export interface InjuryRecord {
  label: string;
  games: number;
}

export interface SeasonRecord {
  season: string;
  year: number;
  age: number;
  clubId: string;
  clubName: string;
  leagueId: string;
  loan: boolean;
  position: PositionId;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  leagueGoals: number;
  assists: number;
  cleanSheets: number;
  rating: number;
  yellow: number;
  red: number;
  /** Detalhes por posição (chutes, passes decisivos, desarmes...). */
  detail?: DetailStats;
  injuries: InjuryRecord[];
  leaguePos: number;
  leagueSize: number;
  competitions: CompetitionResult[];
  trophies: Trophy[];
  awards: Award[];
  ovrStart: number;
  ovrEnd: number;
  attrDelta: Attributes;
  marketValue: number;
  weeklyWage: number;
  national: NationalSeason;
  headlines: string[];
  /** Número de camisa usado no clube nesta temporada. */
  shirtNumber?: number;
  /** ids dos eventos da temporada. */
  events: string[];
  /** Resultado textual das decisões tomadas. */
  eventNotes: string[];
}

export interface TransferRecord {
  season: string;
  fromClubId: string;
  toClubId: string;
  fee: number;
  kind: OfferKind;
}

export interface NationalCareer {
  caps: number;
  goals: number;
  debutSeason?: string;
  tournaments: { season: string; name: string; result: string }[];
  callups?: number;
  starts?: number;
  assists?: number;
  /** Pontos acumulados nas eliminatórias em andamento (atravessam temporadas). */
  qualifiers?: QualifierProgress[];
}

export interface QualifierProgress {
  /** Ex.: "wc-2030", "cont-2032". */
  id: string;
  points: number;
  games: number;
}

export type CareerPhase =
  | 'draft'
  | 'card'
  | 'club-choice'
  | 'hub'
  | 'event'
  | 'season-review'
  | 'offers'
  | 'retired';

export interface LegacyBreakdown {
  key: string;
  label: string;
  points: number;
  max: number;
}

export interface LegacyResult {
  score: number;
  tier: string;
  tierDescription: string;
  breakdown: LegacyBreakdown[];
}

export interface ShirtNumberRecord {
  /** Nome do clube ou "Seleção". */
  team: string;
  clubId?: string;
  kind: 'club' | 'national';
  number: number;
  /** Temporada em que passou a usar o número. */
  since: string;
}

export interface Career {
  version: number;
  id: string;
  seed: number;
  rngState: number;
  createdAt: number;
  updatedAt: number;
  mode: DraftMode;
  profile: PlayerProfile;
  phase: CareerPhase;
  draft: DraftState;
  /** Teto drafted (potencial por atributo). */
  potential: Attributes;
  attributes: Attributes;
  sources: Partial<Record<AttrKey, string>>;
  position: PositionId;
  age: number;
  year: number;
  clubId: string | null;
  parentClubId: string | null;
  weeklyWage: number;
  reputation: number;
  morale: number;
  coachTrust: number;
  /** Clube consegue vaga continental na próxima temporada. */
  continentalQualified: boolean;
  lastLeaguePos: number | null;
  seasons: SeasonRecord[];
  trophies: Trophy[];
  awards: Award[];
  transfers: TransferRecord[];
  national: NationalCareer;
  offers: Offer[];
  events: EventInstance[];
  eventIndex: number;
  modifiers: SeasonModifiers;
  /** Clube que prometeu proposta via evento. */
  promisedClubId: string | null;
  retireAnnounced: boolean;
  forcedRetirementReason: string | null;
  peakOvr: number;
  peakValue: number;
  totalEarnings: number;
  legacy: LegacyResult | null;
  /** Números de camisa usados na carreira (clubes e seleção). Ausente em saves antigos. */
  shirtNumbers?: ShirtNumberRecord[];
  /** Idade em que a carreira terminou (definida na aposentadoria). */
  retirementAge?: number;
  /** Quando a carreira terminou (ms). */
  retiredAt?: number;
}

// ---------- Resumo de carreira encerrada (histórico) ----------

export interface ClubSpellSummary {
  clubId: string;
  name: string;
  country: string;
  from: string;
  to: string;
  seasons: number;
  loan: boolean;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  avgRating: number;
  trophies: { name: string; season: string }[];
  shirtNumbers: number[];
}

export interface SeasonSummary {
  season: string;
  year: number;
  age: number;
  clubId: string;
  clubName: string;
  loan: boolean;
  position: PositionId;
  ovrStart: number;
  ovr: number;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  leagueGoals: number;
  assists: number;
  cleanSheets: number;
  rating: number;
  yellow: number;
  red: number;
  leaguePos: number;
  leagueSize: number;
  marketValue: number;
  weeklyWage: number;
  shirtNumber?: number;
  trophies: string[];
  awards: string[];
  national: { calledUp: boolean; caps: number; goals: number; assists: number };
}

export interface CareerSummary {
  summaryVersion: 1;
  careerId: string;
  /** Quando o resumo foi salvo (ms). */
  savedAt: number;
  /** Conta (uid) para a qual o resumo foi enviado, quando sincronizado na nuvem. */
  cloudUid?: string | null;
  player: {
    name: string;
    nationality: string;
    /** Posição ao fim da carreira e posição inicial. */
    position: PositionId;
    startPosition: PositionId;
    foot: Foot;
    preferredNumber: number;
    startAge: number;
    retirementAge: number;
    careerYears: number;
    firstSeason: string;
    lastSeason: string;
    retiredAt: number;
    retirementReason: string | null;
    mode: DraftMode;
  };
  evolution: {
    peakOvr: number;
    peakOvrSeason: string | null;
    finalOvr: number;
    potentialOvr: number;
    finalAttributes: Attributes;
    topAttributes: { key: AttrKey; value: number }[];
    peakValue: number;
    style: string;
  };
  totals: {
    seasons: number;
    apps: number;
    starts: number;
    minutes: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    avgRating: number;
    yellow: number;
    red: number;
    injuries: number;
    gamesInjured: number;
    detail: DetailStats;
  };
  clubs: ClubSpellSummary[];
  seasons: SeasonSummary[];
  trophies: { kind: TrophyKind; name: string; team: string; season: string; year: number }[];
  awards: Award[];
  national: {
    country: string;
    callups: number;
    caps: number;
    starts: number;
    goals: number;
    assists: number;
    debutSeason: string | null;
    tournaments: { season: string; year: number; name: string; result: string }[];
  };
  transfers: { season: string; fromClub: string; toClub: string; fee: number; kind: OfferKind }[];
  earnings: { total: number; peakWeeklyWage: number };
  shirtNumbers: ShirtNumberRecord[];
  legacy: LegacyResult;
}

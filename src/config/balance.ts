// Parâmetros de balanceamento do FootRise.
// Todos os números que moldam a experiência ficam aqui para facilitar ajustes.

export const CAREER = {
  firstSeasonYear: 2027,
  minStartAge: 16,
  maxStartAge: 20,
  /** A partir desta idade o jogador pode escolher se aposentar (34–39: opcional). */
  canRetireAge: 34,
  /** Ao atingir esta idade a aposentadoria é obrigatória. */
  maxAge: 40,
  /** Abaixo deste OVR, a partir de lowOvrAge, não há mais mercado (o jogador fica no clube). */
  lowOvrRetire: 62,
  lowOvrAge: 33,
  saveVersion: 1,
  historyLimit: 60,
};

export const DRAFT = {
  /** Uma rodada por atributo: 6 atributos = 6 escolhas. */
  rounds: 6,
  legendsPerRound: 3,
  optionsPerLegend: 1,
  /** Valor considerado para slots vazios no cálculo de ganho durante o draft. */
  emptySlotBaseline: 50,
  /** Faixa dos atributos não draftados (vêm da "academia"). */
  academyMin: 42,
  academyMax: 62,
  /** Quantas rodadas candidatas são geradas para escolher a mais interessante. */
  candidateRounds: 24,
  /** Ganho mínimo de potencial que a melhor opção deve oferecer. */
  minBestGain: 2,
  /** Diferença máxima desejada entre a melhor e a segunda melhor opção. */
  maxGainGap: 4,
  /** Valor de 'Jogo com os pés' vindo do passe de jogadores de linha. */
  kickFromPassPenalty: 4,
  /** Chance de a lenda oferecer seu atributo mais forte (assinatura). */
  signatureChance: 0.3,
};

/** Fração do potencial com que o jogador começa, por idade inicial. */
export const START_FACTOR: Record<number, number> = {
  16: 0.76,
  17: 0.785,
  18: 0.81,
  19: 0.835,
  20: 0.86,
};
export const START_NOISE = 2;

export const PLAYING_TIME = {
  /** Titularidade = sigmoid((ovr - forçaClube + offset) / scale). Jogador no nível do elenco ≈ 70% de titularidade. */
  offset: 3,
  scale: 3.4,
  min: 0.03,
  max: 0.96,
  trustWeight: 0.0025,
  subChance: 0.55,
  /** Goleiro: só um joga — a disputa é mais "tudo ou nada". */
  keeperOffset: 4,
  keeperScale: 2.2,
};

export const MATCH = {
  baseGoals: 1.35,
  /** Quanto a diferença de força altera o número de gols esperado. */
  strengthScale: 30,
  playerImpact: 0.12,
  /** Craques (OVR acima de eliteOvr) mudam o patamar do time além da diferença de nível. */
  eliteOvr: 85,
  eliteImpact: 0.08,
  playerImpactCap: 5,
  ratingBase: 6.45,
  ratingPerOvr: 0.028,
  ratingOvrPivot: 75,
  ratingNoise: 0.55,
  goalRating: 0.55,
  assistRating: 0.35,
  winRating: 0.25,
  cleanSheetRating: 0.35,
  yellowPer90: 0.11,
  redPer90: 0.005,
  injuryPerMatch: 0.011,
  cupRounds: 6,
  continentalGroupGames: 6,
  continentalKnockouts: 4,
  nationalSeasonGames: 7,
};

/**
 * Produção individual. A fatia de cada jogador nos gols do time depende de posição,
 * atributos (relativos a 75), nível em relação ao elenco e minutos em campo.
 */
export const STATS = {
  attrPivot: 75,
  /** Expoente da finalização: separa um 98 de um 80 com clareza, sem explodir. */
  finishExp: 1.55,
  /** Expoente da capacidade de chegar às chances (velocidade, drible, físico). */
  accessExp: 0.6,
  creativeExp: 1.8,
  /** Jogador acima do nível do elenco concentra mais bolas (e vice-versa). */
  relScale: 25,
  relMin: 0.72,
  relMax: 1.25,
  /**
   * Retorno decrescente na fatia de gols: acima de goalShareKnee, a fatia cresce com
   * expoente goalShareCompression. Evita que finalização × acesso × nível × clube forte
   * se multipliquem até o craque marcar mais gols que jogos em quase toda temporada.
   */
  goalShareKnee: 0.25,
  goalShareCompression: 0.6,
  maxGoalShare: 0.6,
  maxAssistShare: 0.4,
  maxInvolvement: 0.8,
  /** Na seleção há menos entrosamento e treino: a fatia individual é um pouco menor. */
  nationalShare: 0.8,
  /** Conversão de finalizações: base + por ponto de finalização acima de 50. */
  conversionBase: 0.09,
  conversionPerPoint: 0.003,
  defensiveExp: 1.2,
  /** Pressão defensiva: adversário mais forte = mais ações defensivas. */
  pressureScale: 35,
  keeperSaveBase: 0.68,
  keeperSavePerPoint: 0.006,
  /** Rendimento recente pesa um pouco nos jogos seguintes (fases boas/ruins). */
  momentumDecay: 0.85,
  momentumWeight: 0.12,
  momentumCap: 0.25,
  /** Forma da temporada: desvio do sorteio e quanto ela pesa na produção (temporadas boas, normais e ruins). */
  seasonFormSd: 0.3,
  formProduction: 0.5,
};

export const INJURY_SEVERITY = [
  { label: 'Lesão leve', chance: 0.68, min: 1, max: 3 },
  { label: 'Lesão muscular', chance: 0.25, min: 4, max: 10 },
  { label: 'Lesão grave', chance: 0.07, min: 12, max: 30 },
];

export const EVOLUTION = {
  /** Taxa de aproximação do potencial por idade. */
  growthByAge: [
    { maxAge: 19, rate: 0.28 },
    { maxAge: 21, rate: 0.23 },
    { maxAge: 23, rate: 0.17 },
    { maxAge: 25, rate: 0.12 },
    { maxAge: 27, rate: 0.07 },
    { maxAge: 29, rate: 0.03 },
  ],
  fullMinutes: 2700,
  minMinutesFactor: 0.35,
  ratingPivot: 6.6,
  ratingWeight: 0.45,
  perfMin: 0.5,
  perfMax: 1.4,
  /** Quanto pode ultrapassar o potencial com temporadas excepcionais. */
  overPotentialCap: 2,
  overPotentialRating: 7.6,
  noise: 1,
  declineStartAge: 30,
  keeperDeclineStartAge: 32,
  /** Declínio anual por atributo a cada ano acima do início do declínio. */
  declinePerYear: { pac: 1.3, phy: 1.0, dri: 0.8, sho: 0.6, pas: 0.4, def: 0.7, div: 1.0, ref: 0.9, han: 0.5, gkp: 0.3, kic: 0.3 },
};

export const REPUTATION = {
  start: 8,
  max: 100,
  ratingWeight: 9,
  titleBonus: 3,
  bigTitleBonus: 7,
  awardBonus: 5,
  worldAwardBonus: 12,
  leagueExposureWeight: 0.12,
  decayPerSeason: 3,
  /** Reputação por título, conforme a importância. */
  trophy: { league: 3, cup: 3, continental: 7, clubWorld: 7, worldCup: 15, continentalNation: 8, nationsLeague: 4 },
  tournamentAwardBonus: 6,
  /** Seleção: por convocação e por participação em gols (com teto). */
  perCallup: 0.8,
  callupCap: 4,
  natGoalWeight: 0.4,
  natAssistWeight: 0.2,
  natProductionCap: 4,
  worldCupSquad: 3,
};

export const MARKET = {
  baseValue: 400_000,
  ovrPivot: 60,
  ovrScale: 5.2,
  ageFactor: [
    { maxAge: 21, f: 1.35 },
    { maxAge: 24, f: 1.2 },
    { maxAge: 27, f: 1.0 },
    { maxAge: 29, f: 0.8 },
    { maxAge: 31, f: 0.55 },
    { maxAge: 33, f: 0.32 },
    { maxAge: 99, f: 0.15 },
  ],
  wageBase: 6_000,
  wagePerOvrSq: 160,
  feeMultiplier: 1.1,
};

/**
 * Poder financeiro do comprador nas transferências. É separado da força do elenco:
 * vem da reputação do clube (marca, receitas) e do nível salarial da liga (TV, patrocínios).
 */
export const FINANCE = {
  /** Reputação que vale 0 e 1 no índice financeiro. */
  repFloor: 30,
  repTop: 98,
  /** Nível salarial da liga que já vale o máximo no índice. */
  wageTop: 1.6,
  /** Peso da reputação no índice (o resto vem da liga). */
  repWeight: 0.6,
  /** Faixa aleatória da proposta sobre o valor de mercado: [min, max] + finanças × [minPerFinance, maxPerFinance]. */
  noiseMin: 0.8,
  noiseMax: 1.1,
  noiseMinPerFinance: 0.1,
  noiseMaxPerFinance: 0.15,
  /** Orçamento de referência = budgetBase × e^(índice × budgetScale). Acima dele a proposta é amortecida. */
  budgetBase: 26_000_000,
  budgetScale: 2.85,
  /** Fração do que passa do orçamento que ainda entra na proposta (esforço extra, nunca um corte seco). */
  overBudgetShare: 0.3,
};

export const OFFERS = {
  maxOffers: 4,
  loanMaxAge: 21,
  loanStartShareBelow: 0.4,
  bigClubGap: 6,
};

/** Mercado de fim de carreira: clubes do país e o clube de origem em jogadores em declínio. */
export const TWILIGHT = {
  /** O declínio começa a contar a partir desta idade e atinge peso total ageSpan anos depois. */
  fromAge: 30,
  ageSpan: 5,
  /** Pontos abaixo do pico de OVR para o sinal de queda ficar no máximo. */
  peakDropFull: 6,
  /** Queda de OVR numa única temporada para o sinal de queda ficar no máximo. */
  seasonDropFull: 3,
  /** Com declínio máximo, chance de cada vaga de proposta vir de um clube do país. */
  nationalShare: 0.55,
  /** Diferença máxima de força entre o clube nacional e o nível-alvo da proposta. */
  nationalStrengthWindow: 10,
  /** Com declínio máximo e nível compatível, chance de o clube de origem fazer proposta. */
  originChance: 0.4,
  /** Folga de força (para mais ou para menos) aceita pelo clube de origem por apego. */
  originStrengthSlack: 8,
};

export const NATIONAL = {
  /** OVR necessário ≈ força da seleção - callupGap. */
  callupGap: 7,
  callupScale: 2.4,
  worldCupYearMod: 2,
  continentalYearMod: 0,
  qualifyStrength: 72,
  /** Datas FIFA durante a temporada de clubes (fração das rodadas da liga). */
  windowsAt: [0.12, 0.26, 0.4, 0.7],
  gamesPerWindow: 2,
  /** Peso da forma no clube (nota média) na convocação. */
  clubFormWeight: 1.1,
  /** Bônus para quem foi convocado na data anterior (o técnico mantém a base). */
  continuityBonus: 0.45,
  /** Elenco de torneio é maior: mais fácil de entrar. */
  tournamentSquadBonus: 0.5,
  /** Reserva no clube perde espaço na seleção. */
  benchPenalty: 0.7,
};

export const AWARDS = {
  bestYoungMaxAge: 21,
  minStartsForAwards: 18,
  topScorerNoise: 4,
  leaguePlayerRival: 30,
  /**
   * Bola de Ouro: os outros candidatos do mundo em cada ano (nível médio da temporada e quanto
   * ela varia de um ano para outro). O principal concorrente oscila muito — há anos sem um
   * grande rival e anos em que alguém faz uma temporada histórica. O jogador precisa superar
   * a melhor temporada entre eles.
   */
  worldRivals: [
    { base: 116, sd: 35 },
    { base: 95, sd: 12 },
    { base: 88, sd: 12 },
  ],
  clubPlayerPerf: 16,
  minTopScorerGoals: 15,
  rivalNoise: 5,
};

export const EVENTS = {
  /** Mantido para compatibilidade (o sorteio agora usa countWeights). */
  secondEventChance: 0.45,
  /** Distribuição da quantidade de eventos por temporada (índice = quantidade). */
  countWeights: [0, 8, 22, 30, 22, 12, 6],
  minEvents: 1,
  maxEvents: 6,
  /** Peso de um evento visto nas últimas temporadas. */
  recentPenalty: 0.25,
  /** Peso de um segundo evento da mesma categoria na temporada. */
  sameCategoryPenalty: 0.15,
};

export const LEGACY_TIERS = [
  { min: 95, name: 'ÍCONE', description: 'Um nome que transcende o futebol. Gerações vão te comparar com todo mundo.' },
  { min: 85, name: 'LENDÁRIO', description: 'Uma carreira para os livros de história.' },
  { min: 70, name: 'CRAQUE', description: 'Decidiu jogos grandes e marcou uma era.' },
  { min: 50, name: 'DESTAQUE', description: 'Carreira sólida, respeitada e cheia de bons momentos.' },
  { min: 30, name: 'PROFISSIONAL', description: 'Viveu do futebol com dignidade e honrou a camisa.' },
  { min: 0, name: 'PROMESSA', description: 'O talento estava lá, mas a história não aconteceu.' },
];

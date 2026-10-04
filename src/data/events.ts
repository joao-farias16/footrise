import { ATTR_META, POSITIONS, attrsByImportance } from '../config/positions';
import type { AttrKey, Attributes, Career, Club, PositionId } from '../types';
import type { Rng } from '../engine/rng';
import { tournamentFor } from '../engine/national';
import { clamp } from '../engine/rng';
import { CLUBS, getLeague } from './clubs';
import { getCountry } from './countries';

// Biblioteca de eventos de carreira. Cada evento declara quando pode aparecer,
// o texto e as escolhas com suas consequências.

export interface EventEffects {
  morale?: number;
  coachTrust?: number;
  reputation?: number;
  startShare?: number;
  form?: number;
  injuryRisk?: number;
  goalBonus?: number;
  callup?: number;
  preseasonInjuryGames?: number;
  potential?: Attributes;
  attributes?: Attributes;
  position?: PositionId;
  promisedClubId?: string;
  wageMultiplier?: number;
}

export interface EventOutcome {
  text: string;
  effects: EventEffects;
}

export interface EventContext {
  career: Career;
  ovr: number;
  club: Club;
  startShare: number;
  lastRating: number | null;
}

export type Params = Record<string, string | number>;

export interface EventChoice {
  label: string;
  hint: string;
  resolve: (ctx: EventContext, params: Params, rng: Rng) => EventOutcome;
}

export interface EventDef {
  id: string;
  category: string;
  icon: string;
  /** 0 = não elegível. */
  weight: (ctx: EventContext) => number;
  /**
   * Acontecimento importante da carreira: chance (0–1) de entrar na temporada antes
   * do sorteio normal, quando elegível.
   */
  priority?: (ctx: EventContext) => number;
  /** Eventos que compartilham uma etiqueta não aparecem na mesma temporada (evita situações contraditórias). */
  conflicts?: string[];
  params?: (ctx: EventContext, rng: Rng) => Params;
  title: (params: Params) => string;
  text: (ctx: EventContext, params: Params) => string;
  choices: (ctx: EventContext, params: Params) => EventChoice[];
}

const TEAMMATES = ['Tavares', 'Okafor', 'Lindqvist', 'Moretti', 'Duarte', 'Kovač', 'Silva', 'Haddad', 'Brennan', 'Ruiz', 'Nakamura', 'Fontaine'];
const SPONSORS = ['Volt Energy', 'Nova Boots', 'Apex Watches', 'Lumen Telecom', 'Orbit Wear'];

const ok = (text: string, effects: EventEffects): EventOutcome => ({ text, effects });

/** Temporadas seguidas no clube atual. */
function seasonsAtClub(c: EventContext): number {
  let n = 0;
  for (let i = c.career.seasons.length - 1; i >= 0 && c.career.seasons[i].clubId === c.club.id; i--) n++;
  return n;
}

function lastSeason(c: EventContext) {
  return c.career.seasons[c.career.seasons.length - 1];
}

/** Chegou ao clube nesta janela (transferência ou empréstimo), não a volta de um empréstimo. */
function justArrived(c: EventContext): boolean {
  const t = c.career.transfers[c.career.transfers.length - 1];
  return c.career.seasons.length > 0 && seasonsAtClub(c) === 0 && t?.toClubId === c.club.id;
}

function careerTotal(c: EventContext, key: 'goals' | 'apps'): number {
  return c.career.seasons.reduce((t, s) => t + s[key], 0);
}

/** Próximo marco redondo ainda não atingido. */
function nextMilestone(total: number, marks: number[]): number | undefined {
  return marks.find((m) => m > total);
}

const GOAL_MARKS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800];
const APP_MARKS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Sorteia um clube perto da força alvo (exclui o atual). */
function clubNear(ctx: EventContext, target: number, rng: Rng, filter: (cl: Club) => boolean = () => true): Club {
  const pool = CLUBS.filter((cl) => cl.id !== ctx.club.id && filter(cl));
  return rng.weighted(pool.length > 0 ? pool : CLUBS, (cl) => Math.exp(-Math.abs(cl.strength - target) / 2));
}

export const EVENT_DEFS: EventDef[] = [
  {
    id: 'coach_position',
    category: 'Treinador',
    icon: '📋',
    weight: (c) => (POSITIONS[c.career.position].neighbors.length > 0 && c.career.age <= 30 ? 1 : 0),
    params: (c, rng) => ({ to: rng.pick(POSITIONS[c.career.position].neighbors) }),
    title: () => 'Mudança de posição',
    text: (c, p) =>
      `O treinador do ${c.club.name} quer te testar como ${POSITIONS[p.to as PositionId].label}. Ele acredita que você renderia mais lá.`,
    choices: (_c, p) => [
      {
        label: 'Aceitar a mudança',
        hint: `Vira ${p.to}. O overall é recalculado com os pesos da nova posição.`,
        resolve: () => ok(`Você aceitou jogar como ${POSITIONS[p.to as PositionId].label}. O treinador gostou da atitude.`, { position: p.to as PositionId, coachTrust: 15, startShare: 0.08, morale: -3 }),
      },
      {
        label: 'Recusar',
        hint: 'Mantém a posição, mas a relação com o treinador esfria.',
        resolve: () => ok('Você recusou. O treinador não escondeu a irritação.', { coachTrust: -15, startShare: -0.08 }),
      },
      {
        label: 'Conversar',
        hint: 'Tentar convencê-lo de que você rende mais na posição atual.',
        resolve: (_ctx, _p, rng) =>
          rng.chance(0.6)
            ? ok('A conversa foi ótima: você segue na sua posição e ganhou a confiança do treinador.', { coachTrust: 6, morale: 4 })
            : ok('A conversa não convenceu. Você segue na posição, mas perdeu pontos com o treinador.', { coachTrust: -6 }),
      },
    ],
  },
  {
    id: 'big_club_watching',
    conflicts: ['transfer_talk'],
    category: 'Mercado',
    icon: '🔭',
    weight: (c) => (c.lastRating !== null && c.lastRating >= 6.9 && c.club.strength < 90 ? 1.4 : 0),
    priority: (c) => (c.lastRating !== null && c.lastRating >= 7.2 ? 0.45 : 0),
    params: (c, rng) => {
      const target = c.club.strength + rng.int(5, 10);
      return { target };
    },
    title: () => 'Um gigante está de olho',
    text: () => 'Olheiros de um clube maior foram vistos em todos os seus jogos. A imprensa já especula.',
    choices: () => [
      {
        label: 'Focar no campo',
        hint: 'Sem distrações: melhora sua forma na temporada.',
        resolve: () => ok('Você ignorou o barulho e focou no trabalho.', { form: 0.12, coachTrust: 4 }),
      },
      {
        label: 'Alimentar o interesse',
        hint: 'Garante uma proposta no fim da temporada, mas o clube atual não gosta.',
        resolve: (ctx, p, rng) => {
          const pool = CLUBS.filter((cl) => cl.id !== ctx.club.id);
          const target = Number(p.target);
          const club = rng.weighted(pool, (cl) => Math.exp(-Math.abs(cl.strength - target) / 2));
          return ok(`Seu agente conversou com o ${club.name}. Uma proposta deve chegar no fim da temporada.`, {
            promisedClubId: club.id,
            coachTrust: -12,
            reputation: 3,
          });
        },
      },
    ],
  },
  {
    id: 'preseason_injury',
    conflicts: ['fitness'],
    category: 'Lesão',
    icon: '🩹',
    weight: (c) => 0.6 + Math.max(0, c.career.age - 28) * 0.15,
    title: () => 'Lesão muscular na pré-temporada',
    text: () => 'Você sentiu a coxa no último treino da pré-temporada. Os exames indicam lesão muscular.',
    choices: () => [
      {
        label: 'Tratamento completo',
        hint: 'Perde mais jogos, mas volta 100%.',
        resolve: (_c, _p, rng) => {
          const games = rng.int(4, 7);
          return ok(`Recuperação completa: ${games} jogos fora.`, { preseasonInjuryGames: games });
        },
      },
      {
        label: 'Acelerar o retorno',
        hint: 'Volta rápido, mas há risco de agravar a lesão.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.35)
            ? ok('A lesão voltou mais forte. Foram muitas semanas no departamento médico.', {
                preseasonInjuryGames: rng.int(9, 15),
                attributes: { pac: -1, phy: -1 },
                morale: -8,
              })
            : ok('Deu certo: você voltou em tempo recorde.', { preseasonInjuryGames: rng.int(1, 2), coachTrust: 4 }),
      },
    ],
  },
  {
    id: 'fans_demand',
    category: 'Torcida',
    icon: '📣',
    weight: (c) => (c.startShare < 0.65 && c.lastRating !== null && c.lastRating >= 6.7 ? 1.3 : 0),
    title: () => 'A torcida pede você',
    text: (c) => `Nas arquibancadas do ${c.club.name}, faixas pedem sua titularidade. O treinador foi questionado na coletiva.`,
    choices: () => [
      {
        label: 'Agradecer e trabalhar',
        hint: 'Postura humilde: o treinador valoriza.',
        resolve: () => ok('Sua humildade pegou bem no vestiário. Mais minutos à vista.', { coachTrust: 8, startShare: 0.07 }),
      },
      {
        label: 'Cobrar espaço publicamente',
        hint: 'Pode forçar a titularidade... ou o banco.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.55)
            ? ok('A pressão funcionou: você ganhou a vaga.', { startShare: 0.2, coachTrust: -10, reputation: 2 })
            : ok('O treinador não aceitou a pressão e te deixou no banco.', { startShare: -0.1, coachTrust: -18, morale: -6 }),
      },
    ],
  },
  {
    id: 'press_criticism',
    category: 'Imprensa',
    icon: '📰',
    weight: (c) => (c.lastRating !== null && c.lastRating < 6.7 ? 1.4 : 0.25),
    title: () => 'Críticas na imprensa',
    text: () => 'Depois de uma sequência ruim, um jornal publicou que você "não está à altura do clube".',
    choices: () => [
      {
        label: 'Responder em campo',
        hint: 'Transformar a crítica em combustível.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.6)
            ? ok('Você usou as críticas como motivação. A forma subiu.', { form: 0.15, morale: 5 })
            : ok('A pressão pesou e a fase ruim continuou.', { form: -0.08, morale: -5 }),
      },
      {
        label: 'Rebater na coletiva',
        hint: 'Ganha a torcida, mas cria atrito.',
        resolve: () => ok('Sua resposta viralizou. Torcida do seu lado, diretoria nem tanto.', { reputation: 2, morale: 6, coachTrust: -5 }),
      },
      {
        label: 'Ignorar',
        hint: 'Sem riscos, sem ganhos.',
        resolve: () => ok('Você seguiu em silêncio. A história morreu sozinha.', { morale: -2 }),
      },
    ],
  },
  {
    id: 'mentor',
    category: 'Companheiro',
    icon: '🤝',
    weight: (c) => (c.career.age <= 23 ? 1.1 : 0),
    params: (_c, rng) => ({ name: rng.pick(TEAMMATES) }),
    title: () => 'Um veterano quer te orientar',
    text: (_c, p) => `${p.name}, veterano do elenco, se ofereceu para fazer treinos extras com você após os treinos.`,
    choices: (c) => {
      const focus = attrsByImportance(c.career.position).slice(0, 2);
      return [
        {
          label: 'Aceitar os treinos extras',
          hint: `+2 de potencial em ${focus.map((k) => ATTR_META[k].short).join(' e ')}.`,
          resolve: () =>
            ok('Os treinos extras abriram sua cabeça. Seu teto ficou mais alto.', {
              potential: Object.fromEntries(focus.map((k) => [k, 2])) as Attributes,
              morale: 4,
              injuryRisk: 1.1,
            }),
        },
        {
          label: 'Recusar educadamente',
          hint: 'Preserva o físico para a temporada.',
          resolve: () => ok('Você preferiu manter sua rotina.', { injuryRisk: 0.9 }),
        },
      ];
    },
  },
  {
    id: 'teammate_influence',
    category: 'Companheiro',
    icon: '⚡',
    weight: () => 0.8,
    params: (_c, rng) => ({ name: rng.pick(TEAMMATES) }),
    title: (p) => `${p.name} e a química do elenco`,
    text: (_c, p) => `${p.name}, seu parceiro de setor, vive grande fase e fala que vocês se entendem de olhos fechados. Mas ele anda saindo muito à noite.`,
    choices: () => [
      {
        label: 'Treinar junto e criar sintonia',
        hint: 'Mais entrosamento: melhora a forma.',
        resolve: () => ok('A dupla engrenou. Vocês viraram assunto da temporada.', { form: 0.1, goalBonus: 0.01, morale: 4 }),
      },
      {
        label: 'Acompanhá-lo nas festas',
        hint: 'Popularidade em alta, mas e o rendimento?',
        resolve: (_c, _p, rng) =>
          rng.chance(0.5)
            ? ok('Você ficou mais popular, mas o rendimento caiu.', { reputation: 2, form: -0.15, coachTrust: -6 })
            : ok('Nada de grave: só muita foto nas redes.', { reputation: 2, morale: 5 }),
      },
      {
        label: 'Manter distância',
        hint: 'Foco total, relação fria.',
        resolve: () => ok('Você manteve o foco. A química no campo diminuiu um pouco.', { form: -0.03, coachTrust: 3 }),
      },
    ],
  },
  {
    id: 'national_precall',
    category: 'Seleção',
    icon: '🌍',
    weight: (c) => {
      const bar = getCountry(c.career.profile.nationality).strength;
      return c.career.age >= 18 && c.career.national.caps === 0 && c.ovr >= bar - 13 && c.ovr <= bar - 2 ? 1.6 : 0;
    },
    priority: () => 0.7,
    title: () => 'Você foi pré-convocado!',
    text: () => 'Seu nome apareceu na lista de observação da seleção. A comissão técnica vai acompanhar sua temporada de perto.',
    choices: () => [
      {
        label: 'Manter a regularidade',
        hint: 'Aumenta a chance de convocação sem riscos.',
        resolve: () => ok('Você manteve os pés no chão. A comissão gostou do que viu.', { callup: 0.6, morale: 6 }),
      },
      {
        label: 'Jogar no limite em todo jogo',
        hint: 'Chance ainda maior, mas risco de lesão.',
        resolve: () => ok('Intensidade máxima em cada lance. Seu nome ganhou força.', { callup: 1.2, injuryRisk: 1.35, form: 0.06 }),
      },
    ],
  },
  {
    id: 'training_focus',
    category: 'Treino',
    icon: '🎯',
    weight: (c) => (c.career.age <= 27 ? 1 : 0.3),
    params: (c, rng) => {
      const keys = rng.shuffle(attrsByImportance(c.career.position).slice(0, 4)).slice(0, 3);
      return { a: keys[0], b: keys[1], c: keys[2] };
    },
    title: () => 'Programa de treino individual',
    text: () => 'O departamento de desempenho montou um programa individual. Você pode escolher um foco para a temporada.',
    choices: (_ctx, p) =>
      (['a', 'b', 'c'] as const).map((slot) => {
        const key = p[slot] as AttrKey;
        return {
          label: `Foco em ${ATTR_META[key].label}`,
          hint: `+3 de potencial e +1 imediato em ${ATTR_META[key].short}.`,
          resolve: () => ok(`Foco em ${ATTR_META[key].label.toLowerCase()} definido.`, { potential: { [key]: 3 }, attributes: { [key]: 1 } }),
        };
      }),
  },
  {
    id: 'agent_raise',
    category: 'Contrato',
    icon: '💼',
    weight: (c) => (c.lastRating !== null && c.lastRating >= 7.0 ? 1 : 0.2),
    title: () => 'Seu agente quer renegociar',
    text: () => 'Depois de uma boa fase, seu agente acha que é hora de pedir um aumento salarial.',
    choices: () => [
      {
        label: 'Pedir aumento',
        hint: 'Mais dinheiro, mas a diretoria pode não gostar.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.6)
            ? ok('A diretoria aceitou: salário reajustado em 30%.', { wageMultiplier: 1.3, morale: 5 })
            : ok('Pedido negado. O clima com a diretoria ficou tenso.', { morale: -6, coachTrust: -5 }),
      },
      {
        label: 'Esperar o momento certo',
        hint: 'Mostra comprometimento.',
        resolve: () => ok('Você priorizou o projeto esportivo. O clube notou.', { coachTrust: 6, morale: 2 }),
      },
    ],
  },
  {
    id: 'sponsor',
    category: 'Fama',
    icon: '✨',
    weight: (c) => (c.career.reputation >= 35 ? 1 : 0),
    params: (_c, rng) => ({ brand: rng.pick(SPONSORS) }),
    title: () => 'Proposta de patrocínio',
    text: (_c, p) => `A ${p.brand} quer você como rosto da nova campanha mundial. Muitas gravações durante a temporada.`,
    choices: () => [
      {
        label: 'Aceitar a campanha',
        hint: 'Reputação e moral sobem, mas a agenda pesa.',
        resolve: () => ok('Seu rosto está em outdoors pelo mundo.', { reputation: 6, morale: 5, form: -0.08 }),
      },
      {
        label: 'Recusar e focar no futebol',
        hint: 'Ganha forma e respeito no vestiário.',
        resolve: () => ok('Você recusou a campanha. Foco total no futebol.', { form: 0.08, coachTrust: 4 }),
      },
    ],
  },
  {
    id: 'captaincy',
    category: 'Liderança',
    icon: '©️',
    weight: (c) => (c.career.age >= 25 && c.career.coachTrust >= 58 && c.startShare >= 0.6 ? 1.2 : 0),
    priority: () => 0.5,
    title: () => 'A braçadeira de capitão',
    text: (c) => `O treinador quer que você seja o novo capitão do ${c.club.name}.`,
    choices: () => [
      {
        label: 'Aceitar a braçadeira',
        hint: 'Mais confiança e moral, mais responsabilidade.',
        resolve: () => ok('Você é o novo capitão. O vestiário confia em você.', { coachTrust: 12, morale: 10, reputation: 3, startShare: 0.05 }),
      },
      {
        label: 'Recusar',
        hint: 'Prefere liderar pelo exemplo.',
        resolve: () => ok('Você recusou. Seguirá liderando pelo exemplo.', { morale: -2 }),
      },
    ],
  },
  {
    id: 'new_coach',
    conflicts: ['coach_change'],
    category: 'Treinador',
    icon: '🔄',
    weight: () => 0.6,
    title: () => 'Novo treinador no clube',
    text: (c) => `O ${c.club.name} trocou de treinador. Todo mundo começa do zero na disputa por posição.`,
    choices: () => [
      {
        label: 'Impressionar nos treinos',
        hint: 'Intensidade alta: confiança cresce, risco de lesão também.',
        resolve: () => ok('Você chamou a atenção do novo comandante.', { coachTrust: 12, injuryRisk: 1.2 }),
      },
      {
        label: 'Manter a rotina',
        hint: 'Sem riscos, a relação começa neutra.',
        resolve: () => ok('Você seguiu sua rotina de sempre.', { coachTrust: 0 }),
      },
    ],
  },
  {
    id: 'veteran_minutes',
    category: 'Treinador',
    icon: '⏱️',
    weight: (c) => (c.career.age >= 31 ? 1.4 : 0),
    title: () => 'Gestão de minutos',
    text: () => 'A comissão quer reduzir seus minutos para preservar seu corpo ao longo da temporada.',
    choices: () => [
      {
        label: 'Aceitar o rodízio',
        hint: 'Menos jogos, menos lesões, declínio mais suave.',
        resolve: () => ok('Você aceitou o rodízio. O corpo agradece.', { startShare: -0.15, injuryRisk: 0.6, coachTrust: 6 }),
      },
      {
        label: 'Exigir jogar tudo',
        hint: 'Mais minutos, mais risco.',
        resolve: () => ok('Você bateu o pé: quer jogar todas.', { startShare: 0.06, injuryRisk: 1.4, coachTrust: -8 }),
      },
    ],
  },
  {
    id: 'penalty_taker',
    category: 'Vestiário',
    icon: '⚽',
    weight: (c) => (POSITIONS[c.career.position].group !== 'gk' && (c.career.attributes.sho ?? 0) >= 70 ? 0.9 : 0),
    title: () => 'Disputa pelos pênaltis',
    text: () => 'O cobrador oficial de pênaltis perdeu três seguidas. O treinador abriu a vaga.',
    choices: () => [
      {
        label: 'Assumir as cobranças',
        hint: 'Mais gols, mais pressão.',
        resolve: () => ok('A bola é sua. Pênaltis agora são com você.', { goalBonus: 0.04, morale: 3 }),
      },
      {
        label: 'Deixar para outro',
        hint: 'Menos pressão, foco no seu jogo.',
        resolve: () => ok('Você deixou a responsabilidade com o elenco.', { form: 0.03 }),
      },
    ],
  },
  {
    id: 'social_media',
    category: 'Imprensa',
    icon: '📱',
    weight: (c) => (c.career.reputation >= 20 ? 0.7 : 0),
    title: () => 'Polêmica nas redes',
    text: () => 'Um vídeo seu comemorando de forma provocativa viralizou. A torcida rival está furiosa.',
    choices: () => [
      {
        label: 'Pedir desculpas',
        hint: 'Encerra o caso rapidamente.',
        resolve: () => ok('Desculpas aceitas. Vida que segue.', { reputation: -1, coachTrust: 3 }),
      },
      {
        label: 'Abraçar o personagem',
        hint: 'Mais fama, mais pressão em campo.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.5)
            ? ok('Você virou o vilão favorito do campeonato — e adorou.', { reputation: 5, morale: 6 })
            : ok('A pressão dos rivais pesou nos jogos fora de casa.', { reputation: 3, form: -0.1 }),
      },
    ],
  },
  {
    id: 'rival_signing',
    conflicts: ['role'],
    category: 'Elenco',
    icon: '🆕',
    weight: (c) => (c.startShare >= 0.35 && c.club.strength >= 68 ? 0.9 : 0),
    params: (_c, rng) => ({ name: rng.pick(TEAMMATES) }),
    title: () => 'Concorrência chegando',
    text: (c, p) => `O ${c.club.name} contratou ${p.name}, que joga na sua posição e chega badalado pela imprensa.`,
    choices: (_c, p) => [
      {
        label: 'Encarar a disputa',
        hint: 'Treinos no limite: a titularidade está em jogo.',
        resolve: (ctx, _p, rng) =>
          rng.chance(clamp(0.45 + (ctx.ovr - ctx.club.strength) / 30, 0.2, 0.85))
            ? ok(`Você venceu a disputa. ${p.name} vai ter que esperar a vez dele.`, { startShare: 0.08, coachTrust: 6, form: 0.05 })
            : ok(`${p.name} começou na frente. Você vai ter que reconquistar a vaga ao longo do ano.`, { startShare: -0.12, morale: -5 }),
      },
      {
        label: 'Aceitar o rodízio',
        hint: 'Menos minutos, menos desgaste.',
        resolve: () => ok('Você aceitou dividir a posição. O treinador gostou da postura.', { startShare: -0.08, injuryRisk: 0.85, coachTrust: 4 }),
      },
      {
        label: 'Pedir para sair',
        hint: 'Força uma proposta no fim da temporada, mas o clima fica pesado.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength + rng.int(-3, 2), rng);
          return ok(`Seu agente já conversa com o ${club.name}. A diretoria não gostou nada.`, { promisedClubId: club.id, coachTrust: -10, morale: -3 });
        },
      },
    ],
  },
  {
    id: 'coach_clash',
    category: 'Treinador',
    icon: '😤',
    weight: (c) => (c.career.coachTrust < 45 ? 1.2 : 0.35),
    title: () => 'Discussão com o treinador',
    text: () => 'Depois de ser substituído no intervalo, você discutiu com o treinador no vestiário. O caso vazou para a imprensa.',
    choices: () => [
      {
        label: 'Pedir desculpas publicamente',
        hint: 'Encerra o assunto e recupera a confiança.',
        resolve: () => ok('Desculpas aceitas. O treinador elogiou sua maturidade.', { coachTrust: 10, reputation: -1, morale: -2 }),
      },
      {
        label: 'Manter sua posição',
        hint: 'A torcida pode gostar... ou você pode perder espaço.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.4)
            ? ok('A torcida ficou do seu lado e o treinador recuou.', { coachTrust: -4, morale: 6, reputation: 1 })
            : ok('O treinador não perdoou: você perdeu espaço no time.', { coachTrust: -15, startShare: -0.1 }),
      },
      {
        label: 'Resolver internamente',
        hint: 'Conversa a portas fechadas.',
        resolve: () => ok('Uma conversa franca resolveu tudo. Página virada.', { coachTrust: 4, form: 0.03 }),
      },
    ],
  },
  {
    id: 'hot_streak',
    conflicts: ['fitness', 'mood'],
    category: 'Momento',
    icon: '🔥',
    weight: (c) => (c.lastRating !== null && c.lastRating >= 6.9 ? 1 : 0.4),
    title: () => 'Pré-temporada arrasadora',
    text: () => 'Você terminou a pré-temporada voando: gols, assistências e elogios de toda a comissão técnica.',
    choices: () => [
      {
        label: 'Manter a humildade',
        hint: 'A boa fase continua no campeonato.',
        resolve: () => ok('Pés no chão. A sequência de bons jogos continuou.', { form: 0.12, coachTrust: 5 }),
      },
      {
        label: 'Aproveitar o holofote',
        hint: 'Entrevistas e redes sociais: mais fama, menos foco.',
        resolve: () => ok('Você virou capa de revista. A forma segue boa, mas nem tanto.', { reputation: 4, form: 0.05, morale: 5 }),
      },
    ],
  },
  {
    id: 'slump',
    conflicts: ['mood'],
    category: 'Momento',
    icon: '📉',
    weight: (c) => (c.career.morale < 50 || (c.lastRating !== null && c.lastRating < 6.6) ? 1.2 : 0.25),
    title: () => 'Queda de rendimento',
    text: () => 'Os treinos não rendem, a confiança sumiu e a comissão técnica já percebeu.',
    choices: () => [
      {
        label: 'Trabalhar com psicólogo do esporte',
        hint: 'Recupera a cabeça; o efeito costuma ser bom.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.7)
            ? ok('O acompanhamento fez diferença. Você voltou a se divertir em campo.', { form: 0.1, morale: 8 })
            : ok('Ajudou um pouco, mas a fase ainda não virou.', { form: 0.03, morale: 3 }),
      },
      {
        label: 'Treinos extras',
        hint: 'Trabalho duro, com algum risco físico.',
        resolve: () => ok('Você dobrou a carga de treinos. O ritmo voltou aos poucos.', { form: 0.06, injuryRisk: 1.2, coachTrust: 4 }),
      },
      {
        label: 'Pedir alguns jogos de descanso',
        hint: 'Menos minutos agora, cabeça fresca depois.',
        resolve: () => ok('Alguns jogos fora ajudaram a respirar.', { startShare: -0.06, form: 0.05, morale: 4 }),
      },
    ],
  },
  {
    id: 'comeback',
    conflicts: ['fitness'],
    category: 'Lesão',
    icon: '💪',
    weight: (c) => {
      const last = c.career.seasons[c.career.seasons.length - 1];
      return last && last.injuries.some((i) => i.games >= 10) ? 1.6 : 0;
    },
    priority: () => 0.7,
    title: () => 'Recuperação de lesão',
    text: () => 'Depois de semanas no departamento médico, você foi liberado. Mas o corpo ainda pede cautela.',
    choices: () => [
      {
        label: 'Retorno gradual',
        hint: 'Menos minutos no início, risco de lesão bem menor.',
        resolve: () => ok('Você voltou aos poucos e sem sustos.', { startShare: -0.08, injuryRisk: 0.7, morale: 3 }),
      },
      {
        label: 'Voltar com tudo',
        hint: 'Pode recuperar a vaga rápido... ou recair.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.65)
            ? ok('Voltou como se nunca tivesse saído. A torcida comemorou.', { form: 0.08, coachTrust: 5 })
            : ok('A recaída veio logo nos primeiros treinos.', { preseasonInjuryGames: rng.int(3, 8), morale: -6 }),
      },
    ],
  },
  {
    id: 'contract_renewal',
    category: 'Contrato',
    icon: '✍️',
    weight: (c) => (c.career.age >= 20 && c.startShare >= 0.5 && seasonsAtClub(c) >= 1 && c.career.parentClubId === null ? 1 : 0),
    priority: (c) => (c.lastRating !== null && c.lastRating >= 7.1 ? 0.35 : 0),
    title: () => 'Renovação de contrato',
    text: (c) => `A diretoria do ${c.club.name} quer renovar seu contrato por mais quatro temporadas.`,
    choices: (c) => [
      {
        label: 'Renovar com aumento',
        hint: 'Salário maior e confiança renovada.',
        resolve: () => ok(`Contrato renovado com o ${c.club.name}. Salário reajustado.`, { wageMultiplier: 1.25, coachTrust: 6, morale: 5 }),
      },
      {
        label: 'Renovar com multa baixa',
        hint: 'Salário menor, mas um clube maior pode te tirar no fim da temporada.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength + rng.int(5, 9), rng);
          return ok(`Renovado com multa acessível. O ${club.name} já está de olho.`, { wageMultiplier: 1.1, promisedClubId: club.id, morale: 3 });
        },
      },
      {
        label: 'Deixar para depois',
        hint: 'Aposta em você mesmo.',
        resolve: () => ok('Você preferiu esperar. A diretoria entendeu, mas ficou apreensiva.', { morale: -2, form: 0.04 }),
      },
    ],
  },
  {
    id: 'monthly_award',
    category: 'Prêmio',
    icon: '🏅',
    weight: (c) => (c.lastRating !== null && c.lastRating >= 7.0 ? 1 : 0),
    title: () => 'Melhor jogador do mês',
    text: (c) => `Você foi eleito o melhor jogador do mês na ${getLeague(c.club.leagueId).name}.`,
    choices: () => [
      {
        label: 'Dedicar o prêmio à torcida',
        hint: 'Reputação e moral em alta.',
        resolve: () => ok('A torcida adorou a homenagem.', { reputation: 4, morale: 6 }),
      },
      {
        label: 'Foco no próximo jogo',
        hint: 'Mantém a fase boa.',
        resolve: () => ok('Prêmio guardado na estante, cabeça no próximo jogo.', { form: 0.08, coachTrust: 3 }),
      },
    ],
  },
  {
    id: 'fans_idol',
    category: 'Torcida',
    icon: '❤️',
    weight: (c) => (seasonsAtClub(c) >= 2 && c.career.reputation >= 30 ? 1.1 : 0),
    title: () => 'Ídolo da torcida',
    text: (c) => `A torcida do ${c.club.name} fez um mosaico gigante com seu rosto. Você virou símbolo do clube.`,
    choices: () => [
      {
        label: 'Prometer fidelidade ao clube',
        hint: 'Moral nas alturas, laço forte com o clube.',
        resolve: () => ok('Você jurou amor à camisa. O estádio veio abaixo.', { morale: 10, coachTrust: 5, reputation: 2 }),
      },
      {
        label: 'Agradecer sem promessas',
        hint: 'Carinho mantido, portas abertas.',
        resolve: () => ok('Você agradeceu emocionado, sem prometer nada.', { reputation: 2, morale: 4 }),
      },
    ],
  },
  {
    id: 'national_duty',
    category: 'Seleção',
    icon: '✈️',
    weight: (c) => (c.career.national.caps > 0 ? 0.9 : 0),
    title: () => 'Data FIFA puxada',
    text: () => 'A seleção marcou jogos do outro lado do mundo na mesma semana de um clássico do seu clube.',
    choices: () => [
      {
        label: 'Viajar e honrar a camisa',
        hint: 'O técnico da seleção valoriza; o corpo sente.',
        resolve: () => ok('Você viajou e mostrou serviço. O técnico da seleção anotou.', { callup: 0.5, injuryRisk: 1.15, coachTrust: -3 }),
      },
      {
        label: 'Pedir dispensa',
        hint: 'O clube agradece, a seleção nem tanto.',
        resolve: () => ok('Dispensa aceita. Você ficou para o clássico.', { callup: -0.6, coachTrust: 5, form: 0.04 }),
      },
    ],
  },
  {
    id: 'tournament_year',
    category: 'Seleção',
    icon: '🏆',
    weight: (c) => {
      const t = tournamentFor(c.career.year + 1, c.career.profile.nationality);
      const bar = getCountry(c.career.profile.nationality).strength;
      return t && c.career.age >= 18 && c.ovr >= bar - 12 ? (t.kind === 'worldCup' ? 1.6 : 1.1) : 0;
    },
    priority: () => 0.75,
    params: (c) => ({ name: tournamentFor(c.career.year + 1, c.career.profile.nationality)?.name ?? 'Copa do Mundo' }),
    title: (p) => `Ano de ${p.name}`,
    text: (_c, p) => `O técnico da seleção avisou: só vai à ${p.name} quem estiver jogando bem no clube.`,
    choices: () => [
      {
        label: 'Jogar cada partida como final',
        hint: 'Chance muito maior de convocação, mais risco de lesão.',
        resolve: () => ok('Intensidade máxima. Seu nome está na boca de todos.', { callup: 0.8, form: 0.08, injuryRisk: 1.25 }),
      },
      {
        label: 'Administrar o corpo',
        hint: 'Chega inteiro ao torneio, convocação um pouco menos provável.',
        resolve: () => ok('Você dosou os esforços pensando no meio do ano.', { callup: 0.3, injuryRisk: 0.8 }),
      },
    ],
  },
  {
    id: 'foreign_offer',
    conflicts: ['transfer_talk'],
    category: 'Mercado',
    icon: '🌐',
    weight: (c) => (c.ovr >= 68 && c.career.age <= 31 ? 0.8 : 0),
    title: () => 'Proposta do exterior',
    text: () => 'Um clube de outro país sondou seu agente com uma oferta para o fim da temporada.',
    choices: () => [
      {
        label: 'Abrir negociação',
        hint: 'Garante uma proposta internacional no fim da temporada.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength + rng.int(0, 6), rng, (cl) => cl.country !== ctx.club.country);
          return ok(`O ${club.name} vai formalizar a proposta no fim da temporada.`, { promisedClubId: club.id, coachTrust: -6, reputation: 2 });
        },
      },
      {
        label: 'Recusar e focar no clube',
        hint: 'O clube valoriza o compromisso.',
        resolve: () => ok('Você recusou a sondagem. O clube agradeceu publicamente.', { coachTrust: 5, morale: 2 }),
      },
    ],
  },
  {
    id: 'starting_battle',
    conflicts: ['role'],
    category: 'Treinador',
    icon: '⚔️',
    weight: (c) => (c.startShare >= 0.2 && c.startShare <= 0.65 ? 1.2 : 0),
    title: () => 'Briga pela titularidade',
    text: () => 'O treinador avisou: a vaga está aberta e será de quem render mais na pré-temporada.',
    choices: () => [
      {
        label: 'Dar tudo na pré-temporada',
        hint: 'Pode garantir a vaga. Exige muito do corpo.',
        resolve: (ctx, _p, rng) =>
          rng.chance(clamp(0.5 + (ctx.ovr - ctx.club.strength) / 40, 0.25, 0.8))
            ? ok('A vaga é sua. O treinador anunciou você como titular.', { startShare: 0.15, coachTrust: 8 })
            : ok('Faltou pouco. Você começa como opção no banco.', { startShare: 0.03, injuryRisk: 1.1 }),
      },
      {
        label: 'Ser útil saindo do banco',
        hint: 'Menos minutos, mas entra com o jogo aberto.',
        resolve: () => ok('Você aceitou o papel de 12º jogador.', { startShare: -0.04, form: 0.06, coachTrust: 5 }),
      },
    ],
  },
  // ---------- Treinador e elenco ----------
  {
    id: 'tactical_shift',
    category: 'Treinador',
    icon: '🧠',
    conflicts: ['coach_change'],
    weight: () => 0.7,
    params: (_c, rng) => ({ system: rng.pick(['pressão alta o jogo inteiro', 'linha de três zagueiros', 'contra-ataques em velocidade', 'posse de bola paciente']) }),
    title: () => 'Novo esquema tático',
    text: (c, p) => `A comissão do ${c.club.name} vai mudar o estilo para ${p.system}. Sua função no time muda junto.`,
    choices: () => [
      {
        label: 'Mergulhar no novo modelo',
        hint: 'Mais confiança do treinador. A adaptação custa um pouco no começo.',
        resolve: () => ok('Você estudou cada vídeo e virou peça do novo modelo, mesmo errando no início.', { coachTrust: 8, startShare: 0.05, form: -0.04 }),
      },
      {
        label: 'Manter seu jogo natural',
        hint: 'Rende no seu estilo, mas o treinador pode te ver como um encaixe ruim.',
        resolve: () => ok('Você seguiu jogando do seu jeito. Os números vieram, o treinador ficou desconfiado.', { form: 0.05, coachTrust: -6 }),
      },
    ],
  },
  {
    id: 'bench_role',
    category: 'Elenco',
    icon: '🪑',
    conflicts: ['role'],
    weight: (c) => (c.startShare < 0.35 && c.career.age >= 19 && c.career.parentClubId === null ? 1.2 : 0),
    title: () => 'Fora dos planos',
    text: (c) => `Na lista da pré-temporada do ${c.club.name}, você aparece como terceira opção para a posição.`,
    choices: () => [
      {
        label: 'Brigar pela vaga',
        hint: 'Treinos no limite para mudar a opinião do treinador.',
        resolve: (ctx, _p, rng) =>
          rng.chance(clamp(0.4 + (ctx.ovr - ctx.club.strength) / 30, 0.15, 0.7))
            ? ok('O treinador se rendeu: você subiu na hierarquia do elenco.', { startShare: 0.1, coachTrust: 8, injuryRisk: 1.1 })
            : ok('Você treinou muito, mas a hierarquia não mudou. Pelo menos a forma melhorou.', { form: 0.05, morale: -4, injuryRisk: 1.1 }),
      },
      {
        label: 'Pedir para ser negociado',
        hint: 'Um clube menor deve aparecer no fim da temporada. O clube atual não gosta.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength - rng.int(2, 6), rng);
          return ok(`Seu agente já conversa com o ${club.name}, onde você seria titular.`, { promisedClubId: club.id, coachTrust: -8, morale: 2 });
        },
      },
      {
        label: 'Aceitar o papel de reserva',
        hint: 'Menos atrito e menos desgaste, mas pouco espaço.',
        resolve: () => ok('Você aceitou o papel e virou um reserva respeitado no vestiário.', { coachTrust: 5, injuryRisk: 0.9, morale: -4 }),
      },
    ],
  },
  {
    id: 'unexpected_chance',
    category: 'Elenco',
    icon: '🚪',
    conflicts: ['role'],
    weight: (c) => (c.startShare >= 0.2 && c.startShare <= 0.6 ? 0.8 : 0),
    params: (_c, rng) => ({ name: rng.pick(TEAMMATES) }),
    title: () => 'A vaga caiu no seu colo',
    text: (_c, p) => `${p.name}, titular da sua posição, rompeu o ligamento no último amistoso. O treinador vai precisar de você desde a primeira rodada.`,
    choices: (_c, p) => [
      {
        label: 'Assumir a vaga sem medo',
        hint: 'Mais minutos imediatos. A pressão de substituir um titular é real.',
        resolve: (_ctx, _p, rng) =>
          rng.chance(0.65)
            ? ok(`Você não deixou ninguém sentir falta de ${p.name}.`, { startShare: 0.14, form: 0.04, coachTrust: 5 })
            : ok('A vaga é sua, mas o peso da responsabilidade apareceu nos primeiros jogos.', { startShare: 0.12, form: -0.06 }),
      },
      {
        label: 'Ganhar espaço aos poucos',
        hint: 'Menos minutos de cara, adaptação mais tranquila.',
        resolve: () => ok('Você foi ganhando ritmo sem pressa. O treinador gostou da maturidade.', { startShare: 0.07, morale: 3 }),
      },
    ],
  },
  {
    id: 'star_signing',
    category: 'Clube',
    icon: '🌟',
    conflicts: ['club_mood'],
    weight: (c) => (c.club.strength >= 80 && c.career.age <= 32 ? 0.7 : 0),
    params: (_c, rng) => ({ name: rng.pick(['Vasquez', 'Mbeki', 'Hartmann', 'Laurent', 'Castellano', 'Yilmaz']) }),
    title: () => 'Chega um astro',
    text: (c, p) => `O ${c.club.name} anunciou ${p.name}, um dos maiores nomes do futebol mundial. Ele não joga na sua posição, mas os holofotes mudaram de lugar.`,
    choices: (_c, p) => [
      {
        label: 'Aprender com ele',
        hint: 'Treinar ao lado de um craque eleva seu teto.',
        resolve: (ctx) => {
          const key = attrsByImportance(ctx.career.position)[0];
          return ok(`Você virou sombra de ${p.name} nos treinos. Seu jogo ganhou outra dimensão.`, { potential: { [key]: 2 }, form: 0.03 });
        },
      },
      {
        label: 'Disputar o protagonismo',
        hint: 'Você quer ser a referência do time. Pode render gols ou atrito.',
        resolve: (_ctx, _p, rng) =>
          rng.chance(0.5)
            ? ok('A rivalidade saudável fez bem: vocês dois brilharam.', { goalBonus: 0.015, reputation: 2 })
            : ok('O vestiário percebeu a disputa de egos, e o treinador também.', { coachTrust: -6, morale: -3 }),
      },
    ],
  },
  {
    id: 'key_player_sold',
    category: 'Clube',
    icon: '💔',
    weight: (c) => (c.startShare >= 0.45 && c.career.age >= 20 ? 0.7 : 0),
    params: (_c, rng) => ({ name: rng.pick(TEAMMATES) }),
    title: () => 'O clube vendeu uma peça-chave',
    text: (c, p) => `${p.name}, referência técnica do ${c.club.name}, foi vendido no último dia da janela. A diretoria espera que você ocupe esse vazio.`,
    choices: () => [
      {
        label: 'Assumir a responsabilidade',
        hint: 'Mais bola no seu pé e mais cobrança.',
        resolve: () => ok('Você pediu a bola e assumiu o protagonismo.', { goalBonus: 0.015, startShare: 0.04, morale: -2 }),
      },
      {
        label: 'Seguir no seu papel',
        hint: 'Sem mudanças: o time vai ter que se reinventar.',
        resolve: () => ok('Você manteve sua função. O time sentiu a saída, mas você seguiu firme.', { form: 0.02 }),
      },
      {
        label: 'Questionar o projeto do clube',
        hint: 'Um clube mais forte pode aparecer. A diretoria não vai gostar.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength + rng.int(2, 6), rng);
          return ok(`Suas declarações chegaram ao ${club.name}, que promete uma proposta no fim da temporada.`, { promisedClubId: club.id, coachTrust: -8, reputation: 1 });
        },
      },
    ],
  },
  {
    id: 'club_crisis',
    category: 'Clube',
    icon: '🌧️',
    conflicts: ['club_mood'],
    weight: (c) => {
      const last = lastSeason(c);
      return last && last.clubId === c.club.id && !last.loan && last.leagueSize > 0 && last.leaguePos > last.leagueSize * 0.65 ? 1.2 : 0;
    },
    title: () => 'Clube em crise',
    text: (c) => `Depois da última temporada, o ${c.club.name} vive uma crise: salários atrasados, protestos e a diretoria pedindo sacrifícios.`,
    choices: () => [
      {
        label: 'Aceitar redução salarial',
        hint: 'Ganha o vestiário e a diretoria. Menos dinheiro no bolso.',
        resolve: () => ok('Seu gesto virou exemplo e uniu o elenco.', { wageMultiplier: 0.85, coachTrust: 10, morale: 3, reputation: 1 }),
      },
      {
        label: 'Liderar dentro de campo',
        hint: 'Sem abrir mão do salário, você chama a responsabilidade.',
        resolve: () => ok('Você virou a voz do elenco no momento difícil.', { coachTrust: 5, morale: -3, form: 0.03 }),
      },
      {
        label: 'Buscar uma saída',
        hint: 'Garante uma proposta no fim da temporada. A torcida não perdoa.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength + rng.int(-1, 4), rng);
          return ok(`O ${club.name} vai fazer uma proposta. Nas arquibancadas, você virou alvo.`, { promisedClubId: club.id, morale: -4, coachTrust: -6 });
        },
      },
    ],
  },
  {
    id: 'title_defense',
    category: 'Clube',
    icon: '🛡️',
    conflicts: ['club_mood'],
    weight: (c) => {
      const last = lastSeason(c);
      return last && last.clubId === c.club.id && last.trophies.some((t) => t.kind === 'league' || t.kind === 'continental') ? 1.3 : 0;
    },
    priority: () => 0.3,
    title: () => 'Defender o título',
    text: (c) => `O ${c.club.name} começa a temporada como campeão. Agora todo adversário joga a vida contra vocês.`,
    choices: () => [
      {
        label: 'Manter a fome de vencer',
        hint: 'Mais intensidade desde a pré-temporada, mais desgaste.',
        resolve: () => ok('Você chegou à pré-temporada como se não tivesse ganhado nada.', { form: 0.07, injuryRisk: 1.1, coachTrust: 4 }),
      },
      {
        label: 'Curtir a conquista antes de recomeçar',
        hint: 'Moral nas alturas, mas o começo pode ser mais lento.',
        resolve: () => ok('Férias merecidas e cabeça leve. O ritmo de jogo demorou um pouco a voltar.', { morale: 7, form: -0.04 }),
      },
    ],
  },
  {
    id: 'continental_stage',
    category: 'Clube',
    icon: '🌙',
    weight: (c) => (c.career.continentalQualified && c.startShare >= 0.4 ? 0.7 : 0),
    title: () => 'Noites continentais',
    text: (c) => `O ${c.club.name} está na competição continental. O treinador avisou que vai fazer rodízio entre ela e a liga.`,
    choices: () => [
      {
        label: 'Priorizar a competição continental',
        hint: 'Mais vitrine internacional, mais viagens e desgaste.',
        resolve: () => ok('Você pediu para estar em todas as noites grandes.', { reputation: 2, form: 0.03, injuryRisk: 1.15 }),
      },
      {
        label: 'Aceitar o rodízio',
        hint: 'Menos minutos, corpo mais preservado.',
        resolve: () => ok('Você aceitou o rodízio e chega inteiro aos jogos decisivos.', { startShare: -0.04, injuryRisk: 0.85, coachTrust: 3 }),
      },
    ],
  },
  {
    id: 'loan_spell',
    category: 'Empréstimo',
    icon: '📦',
    weight: (c) => (c.career.parentClubId !== null ? 1.3 : 0),
    title: () => 'De olho no clube dono do passe',
    text: (c) => {
      const parent = CLUBS.find((cl) => cl.id === c.career.parentClubId);
      return `O ${parent?.name ?? 'clube dono do seu passe'} vai acompanhar cada jogo seu no ${c.club.name}. O que você faz nesta temporada pesa no seu futuro.`;
    },
    choices: () => [
      {
        label: 'Jogar para impressionar quem te emprestou',
        hint: 'Intensidade máxima em cada lance.',
        resolve: () => ok('Os relatórios que chegam ao clube dono do seu passe são ótimos.', { form: 0.06, injuryRisk: 1.1 }),
      },
      {
        label: 'Se entregar ao clube atual',
        hint: 'Mais confiança do treinador e mais minutos agora.',
        resolve: () => ok('Você vestiu a camisa do clube e virou peça importante do elenco.', { coachTrust: 8, startShare: 0.05, morale: 3 }),
      },
    ],
  },
  {
    id: 'adaptation',
    category: 'Adaptação',
    icon: '🧳',
    weight: (c) => (justArrived(c) ? 1.6 : 0),
    priority: () => 0.5,
    title: () => 'Vida nova',
    text: (c) =>
      c.club.country !== c.career.profile.nationality
        ? `Novo país, nova língua, novo vestiário. Os primeiros dias no ${c.club.name} vão definir a sua adaptação.`
        : `Nova cidade e novo vestiário. Os primeiros dias no ${c.club.name} vão definir a sua adaptação.`,
    choices: () => [
      {
        label: 'Integrar-se com calma',
        hint: 'Aulas, jantares com o elenco, rotina organizada. O rendimento vem com o tempo.',
        resolve: () => ok('Você se sentiu em casa rapidamente. O elenco te abraçou.', { morale: 6, coachTrust: 4, form: -0.02 }),
      },
      {
        label: 'Mostrar serviço logo de cara',
        hint: 'Pode ganhar a vaga rápido. O corpo e a cabeça cobram.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.6)
            ? ok('Você chegou voando e conquistou a torcida nas primeiras semanas.', { startShare: 0.07, reputation: 1, injuryRisk: 1.1 })
            : ok('A ansiedade pesou: a estreia ficou abaixo do esperado.', { form: -0.06, morale: -3 }),
      },
    ],
  },
  // ---------- Desempenho ----------
  {
    id: 'goal_drought',
    category: 'Momento',
    icon: '🥅',
    weight: (c) => {
      const last = lastSeason(c);
      return POSITIONS[c.career.position].group === 'att' && last && last.apps >= 15 && last.goals < last.apps * 0.2 ? 1.2 : 0;
    },
    title: () => 'O gol sumiu',
    text: () => 'Você terminou a última temporada com poucos gols para um atacante. A cobrança começou cedo.',
    choices: () => [
      {
        label: 'Ficar depois do treino finalizando',
        hint: 'Mais gols, mais carga no corpo.',
        resolve: () => ok('Centenas de finalizações por semana. O pé voltou a calibrar.', { goalBonus: 0.02, injuryRisk: 1.1 }),
      },
      {
        label: 'Jogar mais para o time',
        hint: 'Menos obsessão pelo gol, mais participação no jogo.',
        resolve: () => ok('Você passou a abrir espaços e servir os companheiros. O treinador adorou.', { form: 0.05, coachTrust: 5, goalBonus: -0.01 }),
      },
    ],
  },
  {
    id: 'marked_man',
    category: 'Momento',
    icon: '🎯',
    weight: (c) => (c.lastRating !== null && c.lastRating >= 7.4 ? 1 : 0),
    title: () => 'Todo mundo te conhece agora',
    text: () => 'Depois da temporada que você fez, os adversários estudaram seu jogo. Marcação dobrada já nos amistosos.',
    choices: () => [
      {
        label: 'Reinventar seu repertório',
        hint: 'Trabalho com a análise de desempenho. Seu teto sobe, mas leva tempo.',
        resolve: (ctx) => {
          const keys = attrsByImportance(ctx.career.position).slice(1, 3);
          return ok('Você ganhou novas armas. Os primeiros meses foram de ajuste.', { potential: Object.fromEntries(keys.map((k) => [k, 1])) as Attributes, form: -0.03 });
        },
      },
      {
        label: 'Confiar no que deu certo',
        hint: 'Se funcionou antes, pode funcionar de novo... ou não.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.5)
            ? ok('Nem a marcação dobrada conseguiu te parar.', { form: 0.08, reputation: 1 })
            : ok('Os adversários tinham a lição de casa feita. Foi uma temporada mais difícil.', { form: -0.07 }),
      },
    ],
  },
  {
    id: 'bounce_back',
    category: 'Momento',
    icon: '🔁',
    conflicts: ['mood'],
    weight: (c) => (c.lastRating !== null && c.lastRating < 6.6 && c.career.age <= 32 ? 1 : 0),
    title: () => 'Pré-temporada da redenção',
    text: () => 'A última temporada ficou abaixo do que você esperava. Você chega à pré-temporada querendo provar que foi só uma fase.',
    choices: () => [
      {
        label: 'Contratar um preparador particular',
        hint: 'Corpo mais forte e menos lesões. Efeito gradual.',
        resolve: () => ok('Você voltou das férias em outra forma física.', { injuryRisk: 0.85, form: 0.04 }),
      },
      {
        label: 'Pedir mais minutos ao treinador',
        hint: 'Mais chances de mostrar serviço, mas o treinador pode se irritar.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.5)
            ? ok('O treinador topou te dar uma nova chance como titular.', { startShare: 0.08 })
            : ok('O treinador não gostou da cobrança: “minutos se ganham no treino”.', { coachTrust: -6, morale: -2 }),
      },
      {
        label: 'Desligar do barulho',
        hint: 'Cabeça fresca, sem prometer nada.',
        resolve: () => ok('Você saiu das redes e voltou a jogar por prazer.', { morale: 7 }),
      },
    ],
  },
  {
    id: 'big_match_nerves',
    category: 'Momento',
    icon: '🏟️',
    weight: (c) => (c.career.age <= 23 && c.club.strength >= 75 && c.startShare >= 0.4 ? 0.8 : 0),
    title: () => 'Primeiro clássico como titular',
    text: (c) => `O ${c.club.name} abre a temporada num clássico com estádio lotado, e seu nome está na escalação.`,
    choices: () => [
      {
        label: 'Chamar o jogo para você',
        hint: 'Se der certo, vira manchete. Se der errado, também.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.55)
            ? ok('Atuação de gente grande. Seu nome dominou o noticiário da semana.', { reputation: 3, form: 0.06, morale: 5 })
            : ok('A estreia em clássico pesou: você sumiu do jogo e foi substituído.', { form: -0.05, morale: -4 }),
      },
      {
        label: 'Jogar simples',
        hint: 'Sem brilho, sem erros. O treinador aprova.',
        resolve: () => ok('Você jogou sem errar e ganhou a confiança do treinador.', { coachTrust: 5, form: 0.02 }),
      },
    ],
  },
  // ---------- Marcos ----------
  {
    id: 'milestone_goals',
    category: 'Marco',
    icon: '💯',
    weight: (c) => {
      const last = lastSeason(c);
      const total = careerTotal(c, 'goals');
      const mark = nextMilestone(total, GOAL_MARKS);
      return last && mark && mark - total <= Math.max(3, last.goals * 0.8) ? 1.1 : 0;
    },
    priority: () => 0.35,
    params: (c) => {
      const total = careerTotal(c, 'goals');
      const mark = nextMilestone(total, GOAL_MARKS) ?? total + 1;
      return { mark, missing: mark - total };
    },
    title: (p) => `Rumo ao gol ${p.mark}`,
    text: (_c, p) => `Faltam ${p.missing} ${Number(p.missing) === 1 ? 'gol' : 'gols'} para você chegar a ${p.mark} na carreira por clubes. A contagem já começou nos jornais.`,
    choices: () => [
      {
        label: 'Deixar acontecer naturalmente',
        hint: 'Sem pressa: o marco vem jogando para o time.',
        resolve: () => ok('Você tirou o marco da cabeça e seguiu jogando.', { form: 0.04, coachTrust: 2 }),
      },
      {
        label: 'Ir atrás do marco',
        hint: 'Mais finalizações, mas o elenco pode achar individualista.',
        resolve: () => ok('Você passou a finalizar de qualquer lugar. Os gols vêm, os passes nem tanto.', { goalBonus: 0.015, coachTrust: -4 }),
      },
    ],
  },
  {
    id: 'milestone_apps',
    category: 'Marco',
    icon: '🎖️',
    weight: (c) => {
      const last = lastSeason(c);
      const total = careerTotal(c, 'apps');
      const mark = nextMilestone(total, APP_MARKS);
      return last && mark && mark - total <= Math.max(5, last.apps * 0.8) ? 0.9 : 0;
    },
    params: (c) => {
      const total = careerTotal(c, 'apps');
      const mark = nextMilestone(total, APP_MARKS) ?? total + 1;
      return { mark, missing: mark - total };
    },
    title: (p) => `${p.mark} jogos na carreira`,
    text: (_c, p) => `Se a temporada correr bem, você vai completar ${p.mark} jogos como profissional. ${Number(p.missing) === 1 ? 'Falta só 1' : `Faltam ${p.missing}`}.`,
    choices: () => [
      {
        label: 'Comemorar com a torcida',
        hint: 'Uma festa no estádio quando o marco chegar.',
        resolve: () => ok('O clube já prepara uma camisa comemorativa para o dia.', { morale: 5, reputation: 1 }),
      },
      {
        label: 'Dedicar a quem te ajudou',
        hint: 'Um momento discreto com família e antigos treinadores.',
        resolve: () => ok('Você vai dedicar o marco a quem esteve com você desde a base.', { morale: 4, coachTrust: 2 }),
      },
    ],
  },
  {
    id: 'club_tribute',
    category: 'Marco',
    icon: '🎗️',
    weight: (c) => (seasonsAtClub(c) >= 5 && c.career.age >= 26 ? 1 : 0),
    params: (c) => ({ years: seasonsAtClub(c) }),
    title: () => 'Homenagem do clube',
    text: (c, p) => `O ${c.club.name} vai homenagear suas ${p.years} temporadas seguidas no clube antes do primeiro jogo em casa.`,
    choices: () => [
      {
        label: 'Discurso emocionado no gramado',
        hint: 'Laço ainda mais forte com o clube.',
        resolve: () => ok('O estádio inteiro cantou seu nome. Difícil segurar as lágrimas.', { morale: 7, reputation: 2, coachTrust: 3 }),
      },
      {
        label: 'Aproveitar para renegociar',
        hint: 'Um aumento é provável, mas a torcida pode achar oportunismo.',
        resolve: () => ok('A diretoria aceitou um reajuste. Alguns torcedores não gostaram do momento.', { wageMultiplier: 1.12, morale: -2 }),
      },
    ],
  },
  // ---------- Seleção ----------
  {
    id: 'youth_tournament',
    category: 'Seleção',
    icon: '🌱',
    weight: (c) => (c.career.age <= 20 && c.career.national.caps === 0 ? 0.8 : 0),
    title: () => 'Convocação para a seleção de base',
    text: () => 'A seleção sub-20 do seu país quer você em um torneio internacional no início da temporada, justamente quando o clube define os titulares.',
    choices: () => [
      {
        label: 'Ir ao torneio',
        hint: 'Experiência internacional e vitrine. Perde parte da pré-temporada no clube.',
        resolve: (ctx) => {
          const key = attrsByImportance(ctx.career.position)[0];
          return ok('Você jogou contra os melhores da sua idade e voltou mais maduro.', { potential: { [key]: 1 }, reputation: 2, callup: 0.2, startShare: -0.05 });
        },
      },
      {
        label: 'Ficar no clube',
        hint: 'Brigar por espaço no elenco principal desde o primeiro dia.',
        resolve: () => ok('Você ficou e o treinador notou o comprometimento.', { startShare: 0.05, coachTrust: 5 }),
      },
    ],
  },
  {
    id: 'national_snub',
    category: 'Seleção',
    icon: '📵',
    weight: (c) => {
      const last = lastSeason(c);
      return c.career.national.caps > 0 && last && !last.national.calledUp && c.career.age <= 33 ? 1.1 : 0;
    },
    title: () => 'Fora da seleção',
    text: () => 'Seu nome ficou fora das últimas listas da seleção. Jornalistas perguntam se a sua história com a camisa acabou.',
    choices: () => [
      {
        label: 'Responder em campo',
        hint: 'Jogar cada partida pensando na próxima convocação.',
        resolve: () => ok('Você transformou a ausência em motivação.', { callup: 0.5, form: 0.04, injuryRisk: 1.1 }),
      },
      {
        label: 'Cobrar o técnico publicamente',
        hint: 'Pode pressioná-lo... ou fechar a porta de vez.',
        resolve: (_c, _p, rng) =>
          rng.chance(0.4)
            ? ok('A imprensa comprou sua briga e o técnico prometeu te observar.', { callup: 0.5, reputation: 1 })
            : ok('O técnico da seleção não gostou nada. A porta ficou mais fechada.', { callup: -0.5, morale: -3 }),
      },
      {
        label: 'Focar só no clube',
        hint: 'Menos pressão. A seleção fica em segundo plano.',
        resolve: () => ok('Você decidiu que a seleção vai ser consequência.', { coachTrust: 4, form: 0.03, callup: -0.2 }),
      },
    ],
  },
  {
    id: 'national_veteran',
    category: 'Seleção',
    icon: '🧓',
    weight: (c) => {
      const last = lastSeason(c);
      return c.career.age >= 31 && c.career.national.caps >= 10 && last?.national.calledUp ? 1.1 : 0;
    },
    title: () => 'Renovação na seleção',
    text: () => 'O técnico da seleção quer renovar o grupo e perguntou, com respeito, se você ainda quer ser convocado.',
    choices: () => [
      {
        label: 'Seguir à disposição',
        hint: 'Mantém a seleção, mas o calendário pesa no corpo.',
        resolve: () => ok('Você segue no grupo, agora como uma das vozes mais experientes.', { callup: 0.3, injuryRisk: 1.1 }),
      },
      {
        label: 'Abrir espaço para os jovens',
        hint: 'Menos convocações, mais descanso para render no clube.',
        resolve: () => ok('Você deixou a seleção em segundo plano. O clube agradece o corpo descansado.', { callup: -1, injuryRisk: 0.8, coachTrust: 4, morale: 2 }),
      },
    ],
  },
  // ---------- Mercado ----------
  {
    id: 'same_league_rival',
    category: 'Mercado',
    icon: '🔀',
    conflicts: ['transfer_talk'],
    weight: (c) =>
      c.ovr >= 66 && c.career.age <= 31 && c.career.parentClubId === null && CLUBS.some((cl) => cl.leagueId === c.club.leagueId && cl.strength > c.club.strength)
        ? 0.7
        : 0,
    params: (c, rng) => {
      const club = clubNear(c, c.club.strength + rng.int(3, 8), rng, (cl) => cl.leagueId === c.club.leagueId && cl.strength > c.club.strength);
      return { clubId: club.id, name: club.name };
    },
    title: () => 'Sondagem de um rival da liga',
    text: (c, p) => `O ${p.name}, adversário do ${c.club.name} na liga, quer te contratar. A notícia vazou e a torcida já se manifesta.`,
    choices: (_c, p) => [
      {
        label: 'Ouvir a proposta',
        hint: 'Garante a proposta no fim da temporada. A torcida vai chamar de traição.',
        resolve: () => ok(`O ${p.name} vai formalizar a oferta. No seu estádio, você ouviu as primeiras vaias.`, { promisedClubId: String(p.clubId), morale: -4, coachTrust: -6 }),
      },
      {
        label: 'Fechar a porta publicamente',
        hint: 'A torcida te abraça. O rival vira a página.',
        resolve: () => ok('Sua resposta virou faixa na arquibancada.', { morale: 5, reputation: 1, coachTrust: 4 }),
      },
    ],
  },
  {
    id: 'homeland_call',
    category: 'Mercado',
    icon: '🏠',
    conflicts: ['transfer_talk'],
    weight: (c) =>
      c.career.age >= 29 && c.club.country !== c.career.profile.nationality && CLUBS.some((cl) => cl.country === c.career.profile.nationality) ? 0.9 : 0,
    title: () => 'O chamado de casa',
    text: (c) => `Um clube de ${getCountry(c.career.profile.nationality).name} procurou seu agente: querem você de volta ao seu país.`,
    choices: () => [
      {
        label: 'Abrir conversa',
        hint: 'Garante uma proposta de um clube do seu país no fim da temporada.',
        resolve: (ctx, _p, rng) => {
          const home = ctx.career.profile.nationality;
          const club = clubNear(ctx, Math.min(ctx.ovr, ctx.club.strength) - rng.int(0, 4), rng, (cl) => cl.country === home);
          return ok(`O ${club.name} vai fazer a proposta. A ideia de voltar para casa mexeu com você.`, { promisedClubId: club.id, morale: 4, coachTrust: -3 });
        },
      },
      {
        label: 'Ainda não é a hora',
        hint: 'Você quer seguir competindo no exterior.',
        resolve: () => ok('Você agradeceu o carinho, mas segue focado onde está.', { form: 0.03, coachTrust: 3 }),
      },
    ],
  },
  {
    id: 'transfer_rumours',
    category: 'Mercado',
    icon: '🗞️',
    conflicts: ['transfer_talk'],
    weight: (c) => (c.career.reputation >= 45 && c.career.parentClubId === null ? 0.8 : 0),
    params: (c, rng) => ({ name: clubNear(c, c.club.strength + rng.int(3, 8), rng).name }),
    title: () => 'Especulação nos jornais',
    text: (c, p) => `Jornais garantem que você já acertou com o ${p.name}. Ninguém te procurou, mas a torcida do ${c.club.name} quer uma resposta.`,
    choices: () => [
      {
        label: 'Desmentir',
        hint: 'O assunto morre e o clube agradece.',
        resolve: () => ok('Você desmentiu tudo. O vestiário respirou aliviado.', { coachTrust: 4, morale: 1 }),
      },
      {
        label: 'Não comentar',
        hint: 'Sua cotação sobe, mas o barulho atrapalha.',
        resolve: () => ok('O silêncio alimentou as manchetes durante semanas.', { reputation: 2, coachTrust: -4, form: -0.03 }),
      },
    ],
  },
  {
    id: 'low_form_offer',
    category: 'Mercado',
    icon: '🪂',
    conflicts: ['transfer_talk'],
    weight: (c) => (c.lastRating !== null && c.lastRating < 6.6 && c.career.age >= 22 && c.career.age <= 31 && c.career.parentClubId === null ? 0.9 : 0),
    title: () => 'Proposta na hora difícil',
    text: () => 'Mesmo depois de uma temporada fraca, um clube menor procurou seu agente: lá você seria protagonista.',
    choices: () => [
      {
        label: 'Aceitar conversar',
        hint: 'Um recomeço como titular em um clube menor no fim da temporada.',
        resolve: (ctx, _p, rng) => {
          const club = clubNear(ctx, ctx.club.strength - rng.int(3, 7), rng);
          return ok(`O ${club.name} vai fazer a proposta. Pode ser o recomeço que você precisa.`, { promisedClubId: club.id, morale: 3, coachTrust: -4 });
        },
      },
      {
        label: 'Ficar e virar o jogo',
        hint: 'Você quer reconquistar seu espaço onde está.',
        resolve: () => ok('Você decidiu ficar e lutar pelo seu lugar.', { form: 0.04, morale: -2, coachTrust: 4 }),
      },
    ],
  },
  // ---------- Físico ----------
  {
    id: 'fatigue_warning',
    category: 'Físico',
    icon: '🔋',
    weight: (c) => {
      const last = lastSeason(c);
      return last && (last.minutes >= 3800 || last.apps >= 52) ? 1.1 : 0;
    },
    title: () => 'Sinal amarelo na fisiologia',
    text: () => 'Depois de uma temporada com muitos minutos, os exames da pré-temporada mostram sinais de sobrecarga.',
    choices: () => [
      {
        label: 'Seguir o plano de carga',
        hint: 'Alguns jogos poupados, risco de lesão bem menor.',
        resolve: () => ok('Você seguiu a fisiologia à risca e vai ser poupado em alguns jogos.', { injuryRisk: 0.75, startShare: -0.06 }),
      },
      {
        label: 'Ignorar e jogar tudo',
        hint: 'Mais minutos, mais risco.',
        resolve: () => ok('Você quer estar em campo em todos os jogos, com ou sem alerta.', { injuryRisk: 1.3, startShare: 0.03, coachTrust: -2 }),
      },
    ],
  },
  {
    id: 'fitness_peak',
    category: 'Físico',
    icon: '🏃',
    conflicts: ['fitness'],
    weight: (c) => {
      const last = lastSeason(c);
      return c.career.age >= 20 && c.career.age <= 29 && last && !last.injuries.some((i) => i.games >= 5) ? 0.7 : 0;
    },
    title: () => 'Melhores testes físicos da carreira',
    text: () => 'Os testes da pré-temporada mostraram os melhores números da sua carreira em velocidade e resistência.',
    choices: () => [
      {
        label: 'Aproveitar para treinar explosão',
        hint: 'Ganho físico imediato, um pouco mais de risco de lesão.',
        resolve: () => ok('Você subiu a carga de treinos de força e explosão.', { attributes: { pac: 1, phy: 1 }, injuryRisk: 1.1 }),
      },
      {
        label: 'Manter o equilíbrio',
        hint: 'Chegar inteiro e confiante ao início da temporada.',
        resolve: () => ok('Você manteve a rotina e chega afiado à primeira rodada.', { form: 0.05, injuryRisk: 0.95 }),
      },
    ],
  },
  {
    id: 'nagging_knock',
    category: 'Físico',
    icon: '🦵',
    conflicts: ['fitness'],
    weight: (c) => (c.career.age >= 26 ? 0.5 + Math.max(0, c.career.age - 30) * 0.1 : 0),
    title: () => 'Incômodo no tornozelo',
    text: () => 'Um incômodo no tornozelo apareceu no fim da pré-temporada. Os médicos dizem que dá para jogar, mas não seria o ideal.',
    choices: () => [
      {
        label: 'Jogar no sacrifício',
        hint: 'O treinador valoriza a entrega. O corpo pode cobrar.',
        resolve: () => ok('Você entrou em campo com o tornozelo enfaixado.', { coachTrust: 5, form: -0.04, injuryRisk: 1.25 }),
      },
      {
        label: 'Parar para tratar',
        hint: 'Perde os primeiros jogos e volta sem dor.',
        resolve: (_c, _p, rng) => ok('Duas semanas de tratamento e o incômodo desapareceu.', { preseasonInjuryGames: rng.int(1, 3), injuryRisk: 0.85 }),
      },
    ],
  },
  // ---------- Fim de carreira ----------
  {
    id: 'veteran_leader',
    category: 'Liderança',
    icon: '🧭',
    weight: (c) => (c.career.age >= 31 ? 1 : 0),
    params: (_c, rng) => ({ name: rng.pick(TEAMMATES) }),
    title: () => 'Referência para os jovens',
    text: (c, p) => `${p.name}, de 18 anos, é a maior promessa da base do ${c.club.name}. O treinador quer que você seja o mentor dele.`,
    choices: () => [
      {
        label: 'Abraçar o papel de mentor',
        hint: 'Respeito no vestiário. Divide tempo e minutos com o garoto.',
        resolve: () => ok('Você virou o conselheiro do vestiário.', { coachTrust: 8, morale: 5, startShare: -0.04 }),
      },
      {
        label: 'Focar no seu próprio jogo',
        hint: 'Sua prioridade continua sendo render em campo.',
        resolve: () => ok('Você deixou claro que ainda está aqui para jogar.', { form: 0.04, coachTrust: -2 }),
      },
    ],
  },
  {
    id: 'retirement_whispers',
    category: 'Carreira',
    icon: '⌛',
    weight: (c) => (c.career.age >= 33 && !c.career.retireAnnounced ? 1.1 : 0),
    title: () => 'Perguntas sobre o futuro',
    text: () => 'Em toda entrevista a pergunta se repete: até quando você vai jogar? A decisão continua sendo sua.',
    choices: () => [
      {
        label: '"Ainda tenho muito a dar"',
        hint: 'Motivação extra para provar que segue em alto nível.',
        resolve: () => ok('Você respondeu com fome de bola. A imprensa adorou.', { morale: 4, form: 0.04 }),
      },
      {
        label: 'Aproveitar cada jogo',
        hint: 'Sem pressão, curtindo a reta final. A torcida retribui o carinho.',
        resolve: () => ok('Você passou a jogar com outro sorriso no rosto.', { morale: 6, reputation: 1, coachTrust: 2 }),
      },
    ],
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENT_DEFS.map((e) => [e.id, e]));

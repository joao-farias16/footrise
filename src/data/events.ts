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
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENT_DEFS.map((e) => [e.id, e]));

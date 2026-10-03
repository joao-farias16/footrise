# FootRise

> Monte um jogador com o DNA de lendas. Viva a carreira. Construa um legado.

**FootRise** é um simulador de carreira de futebol para o navegador. Você cria um atleta, monta o potencial dele em um **draft de atributos de lendas do futebol**, escolhe clubes e acompanha a carreira temporada a temporada — da estreia aos 16–20 anos até a aposentadoria e o cálculo do legado. Uma carreira completa leva poucos minutos.

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Sistema de simulação](#sistema-de-simulação)
- [Contas, autenticação e salvamento](#contas-autenticação-e-salvamento)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Instalação e execução](#instalação-e-execução)
- [Firebase](#firebase)
- [Testes](#testes)
- [Desenvolvimento](#desenvolvimento)
- [Status do projeto](#status-do-projeto)
- [Aviso](#aviso)

---

## Visão geral

1. **Criação do jogador** — nome, nacionalidade, idade inicial (16 a 20 anos), posição, pé dominante e número da camisa.
2. **Draft** — uma rodada por atributo da posição (6 rodadas). Em cada rodada aparecem três lendas e você escolhe **um atributo** de uma delas: a velocidade de um, a finalização de outro. Cada atributo só pode ser preenchido uma vez; os que não forem escolhidos vêm da **academia** (valores entre 42 e 62).
3. **A carta** — o draft define o **potencial** do jogador e a origem de cada atributo. Você começa abaixo desse teto (quanto mais jovem, mais distante) e a carreira decide quanto dele será alcançado.
4. **Carreira** — escolha do primeiro clube, eventos de carreira com decisões, simulação da temporada, revisão dos números e propostas de transferência.
5. **Aposentadoria e legado** — a carreira recebe uma nota de 0 a 100 e uma classificação, e pode ser salva no histórico.

## Funcionalidades

### Criação e draft
- Criação do jogador com **9 posições**: Goleiro, Lateral Direito, Zagueiro, Lateral Esquerdo, Volante, Meia, Ponta Direita, Ponta Esquerda e Atacante.
- Atributos de linha: Velocidade, Finalização, Passe, Drible, Defesa e Físico. Goleiros têm atributos próprios: Elasticidade, Manuseio, Reflexos, Posicionamento, Jogo com os pés e Físico.
- Overall calculado com **pesos diferentes por posição**.
- **Draft com 108 lendas** de várias posições, eras e países, com rodadas montadas para gerar dilemas entre opções.
- **Origem dos atributos**: a carta mostra de qual lenda (ou da academia) veio cada atributo.
- **Dois modos de draft**: **Analista** (números e impacto no potencial visíveis) e **Instinto** (números ocultos).
- **Reroll**: uma vez por carreira é possível sortear novamente as opções da rodada atual.
- **Estilo de jogo** derivado dos atributos (por exemplo, Finalizador, Meia cerebral, Muralha, Goleiro-líbero).

### Carreira
- **40 ligas** em cinco continentes e **366 clubes** com força, reputação e nível salarial próprios.
- **Propostas de clubes** no início e ao fim de cada temporada, com titularidade esperada, exposição, chance de títulos e salário.
- **Transferências** com valor de mercado, salário semanal e **empréstimos** para jovens sem espaço no clube.
- **Números de camisa** por clube e seleção, com histórico.
- **28 eventos de carreira** (treinador, mercado, lesão, torcida, imprensa, seleção, vestiário etc.) com escolhas que afetam forma, titularidade, moral, risco de lesão e reputação.
- **Seleção nacional**: convocações, Datas FIFA, eliminatórias, liga das nações, Copa do Mundo e torneios continentais.
- **Competições de clubes**: liga, copa nacional, torneio continental e Mundial de Clubes.
- **Títulos e prêmios individuais**: artilheiro da liga, melhor goleiro, craque do clube, melhor jogador da liga, Prêmio Revelação Mundial, Coroa de Ouro FootRise e prêmios de torneios de seleções.
- **Reputação**, moral e confiança do treinador ao longo da carreira.
- **Aposentadoria** opcional a partir dos 34 anos e obrigatória aos 40. Jogadores com overall baixo em idade avançada deixam de receber propostas.
- **Legado**: nota de 0 a 100 com detalhamento e classificação — PROMESSA, PROFISSIONAL, DESTAQUE, CRAQUE, LENDÁRIO ou ÍCONE.

### Histórico e interface
- **Minhas carreiras**: histórico de carreiras encerradas com resumo completo (temporada a temporada, clubes, troféus, prêmios, seleção, transferências e atributos finais), ordenação por data ou legado e exclusão.
- Interface responsiva (celular, tablet e desktop) com opção de reduzir animações.

## Sistema de simulação

Cada temporada é simulada **partida a partida**, com um modelo de Poisson para os placares: liga, copa nacional, competição continental (quando o clube se classifica), Mundial de Clubes e jogos da seleção. A cada partida o jogo decide se o jogador é titular, entra no decorrer do jogo ou fica de fora, e registra gols, assistências, nota, minutos, cartões, lesões e estatísticas detalhadas (finalizações, passes decisivos, desarmes, interceptações, cortes, defesas e gols sofridos).

O desempenho é influenciado por:

- **Atributos** — finalização, acesso às chances (velocidade, drible, físico) e criação definem a participação nos gols do time; defesa e físico definem as ações defensivas; atributos de goleiro definem o aproveitamento de defesas.
- **Posição** — cada posição tem um perfil estatístico próprio: atacantes marcam mais, meias criam mais, zagueiros e volantes defendem mais e goleiros têm estatísticas específicas.
- **Força do clube e dos adversários** — times mais fortes criam e marcam mais; adversários mais fortes reduzem a produção ofensiva e aumentam a carga defensiva. O nível do jogador em relação ao elenco também influencia a titularidade e a participação.
- **Minutos e titularidade** — dependem do overall em relação ao elenco, da confiança do treinador e da posição. A produção é proporcional ao tempo em campo.
- **Forma** — cada temporada sorteia uma forma (influenciada pela moral e pelos eventos), que pode gerar anos excelentes, normais ou abaixo do esperado. Durante a temporada, sequências de boas ou más atuações também pesam.
- **Idade** — jovens evoluem mais rápido, a partir dos 30 anos (32 para goleiros) começa o declínio, e jogadores mais velhos têm mais risco de lesão.
- **Lesões e suspensões** — reduzem as partidas disponíveis.
- **Evolução** — ao fim de cada temporada os atributos se aproximam do potencial conforme idade, minutos, nota média e nível da liga; temporadas excepcionais permitem ultrapassar levemente o potencial.

**Objetivo do balanceamento:** jogadores de maior qualidade têm, em média, números claramente melhores e potencial para temporadas históricas, mas a produção tem retorno decrescente no topo e as temporadas variam naturalmente. Um craque pode dominar um ano e ter um ano apenas bom no seguinte — o resultado não é determinado só pelo overall.

Todos os parâmetros de balanceamento ficam em `src/config/balance.ts`, e os perfis por posição em `src/config/positions.ts`. O gerador aleatório tem seed salva na carreira, então os resultados são reproduzíveis.

## Contas, autenticação e salvamento

- **Neste navegador (sempre):** a carreira ativa é salva no `localStorage` a cada ação. O jogo funciona por completo sem conta.
- **Na nuvem (opcional):** com o Firebase configurado, o jogador pode criar uma conta com **nome de usuário, e-mail e senha** (Firebase Authentication, e-mail/senha). Também há login, logout e recuperação de senha por e-mail.
- **Perfil:** o nome de usuário escolhido no cadastro é salvo no perfil do Cloud Firestore e exibido como nome da conta, com o e-mail abaixo dele.
- **Sincronização:** para usuários autenticados, a carreira ativa é enviada automaticamente para o Cloud Firestore, e as carreiras encerradas salvas ficam no histórico da conta. Se a cópia local e a da nuvem divergirem, o jogo pergunta qual manter — nada é sobrescrito sem confirmação.
- **Regras de segurança** (`firestore.rules`): cada usuário só lê e escreve os próprios dados.

## Tecnologias

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Firebase](https://firebase.google.com/) — Authentication (e-mail/senha) e Cloud Firestore
- CSS próprio (sem framework de UI)
- [Vitest](https://vitest.dev/) e `@firebase/rules-unit-testing` para os testes
- Firebase Emulator Suite para testes locais de autenticação e Firestore

O app é estático: não há servidor próprio, e a nuvem é feita diretamente pelo SDK do Firebase.

## Estrutura do projeto

```
src/
  cloud/        integração com o Firebase (configuração, serviço de Auth/Firestore, testes no emulador)
  config/       parâmetros de balanceamento e perfis/pesos por posição
  data/         lendas, países, ligas, clubes e eventos
  engine/       motor do jogo, sem React: overall, draft, partida, temporada, evolução,
                mercado, propostas, seleção, prêmios, eventos, legado e orquestração da carreira
  state/        persistência local, sincronização com a nuvem e contexto React
  ui/           componentes e telas
  types.ts      tipos de domínio
firestore.rules regras de segurança do Firestore
firebase.json   configuração das regras e do Emulator Suite
.env.example    modelo das variáveis de ambiente
```

O motor não depende do React: cada ação (`draftPick`, `startSeason`, `acceptOffer`...) recebe uma carreira e devolve uma nova.

## Instalação e execução

**Requisitos:** Node.js 22.12 ou superior (o Vitest 5 exige Node 22.12+; o Vite 8 aceita 20.19+) e npm. Para os testes de nuvem, também é preciso Java instalado (Firebase Emulator Suite).

```bash
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
npm run build        # verificação de tipos + build de produção em dist/
npm run preview      # serve o build de produção localmente
```

Sem variáveis de ambiente o jogo roda normalmente, só com salvamento local. Para habilitar contas e nuvem, veja [Firebase](#firebase).

O build usa caminhos relativos e pode ser hospedado em qualquer serviço de arquivos estáticos.

## Firebase

As contas e o salvamento em nuvem dependem de um projeto Firebase próprio. As credenciais **não fazem parte do repositório** e devem ser configuradas localmente:

1. No [Console do Firebase](https://console.firebase.google.com/), crie um projeto com um app Web, habilite **Authentication → E-mail/senha** e crie o **Cloud Firestore**.
2. Copie `.env.example` para `.env.local` e preencha com os dados do app Web:

   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   ```

   `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID` e `APP_ID` são obrigatórias para ativar a nuvem.

3. Publique as regras de segurança:

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

Nunca faça commit do `.env.local`.

**Desenvolvimento sem projeto real:** `npm run emulators` sobe Auth e Firestore locais com um projeto de demonstração. Para apontar o app para eles, use as variáveis de exemplo comentadas no `.env.example` (incluindo `VITE_FIREBASE_USE_EMULATOR=true`).

## Testes

```bash
npm test             # testes do motor e do estado (Vitest)
npm run typecheck    # verificação de tipos (tsc --noEmit)
npm run test:cloud   # regras do Firestore + serviço de nuvem no Firebase Emulator Suite (requer Java)
npm run test:watch   # Vitest em modo watch
```

Os testes cobrem overall, draft e reroll, simulação e estatísticas por nível e posição, evolução, transferências, seleção, aposentadoria, legado, persistência local, sincronização e, no emulador, cadastro, login, perfil, regras de segurança e salvamento na nuvem.

## Desenvolvimento

```bash
npm run dev          # desenvolvimento com recarregamento automático
npm run test:watch   # testes rodando a cada alteração
npm run emulators    # Auth + Firestore locais
```

Ajustes de jogabilidade normalmente ficam restritos a `src/config/balance.ts` e `src/config/positions.ts`.

## Status do projeto

O FootRise é jogável de ponta a ponta: criação, draft, carreira completa, aposentadoria, legado, histórico e salvamento local ou em nuvem estão implementados e cobertos por testes. Não há ranking global nem compartilhamento de carreiras entre usuários.

## Aviso

Nomes de jogadores reais aparecem apenas como referência esportiva no draft. Os atributos das lendas são estimativas próprias do jogo, não dados oficiais. Clubes reais aparecem apenas pelo nome, com escudos estilizados gerados pelo jogo (sem escudos ou marcas oficiais), e as competições continentais e os prêmios individuais têm nomes próprios do FootRise.

# FootRise

> Monte um jogador com o DNA de lendas. Viva a carreira. Construa um legado.

**FootRise** é um simulador de carreira de futebol para o navegador. Você cria o seu próprio atleta, define o potencial dele em um **draft de atributos de lendas do futebol**, escolhe clubes e acompanha a carreira temporada a temporada — da estreia aos 16–20 anos até a aposentadoria e o cálculo do legado. Uma carreira completa leva poucos minutos.

---

## Sumário

- [Sobre o FootRise](#sobre-o-footrise)
- [Como funciona uma carreira](#como-funciona-uma-carreira)
- [Funcionalidades](#funcionalidades)
- [OVR e evolução](#ovr-e-evolução)
- [Simulação de temporadas](#simulação-de-temporadas)
- [Transferências e mercado](#transferências-e-mercado)
- [Final da carreira e legado](#final-da-carreira-e-legado)
- [Contas, autenticação e salvamento](#contas-autenticação-e-salvamento)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Instalação e execução](#instalação-e-execução)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Firebase](#firebase)
- [Testes](#testes)
- [Desenvolvimento](#desenvolvimento)
- [Status do projeto](#status-do-projeto)
- [Próximos passos](#próximos-passos)
- [Aviso](#aviso)

---

## Sobre o FootRise

A ideia central do FootRise é separar **potencial** de **carreira**. No draft, você monta um jogador "impossível", combinando atributos inspirados em lendas de várias eras — a velocidade de um, a finalização de outro. Esse draft define até onde o atleta *pode* chegar. O quanto ele realmente alcança depende da carreira: minutos em campo, desempenho, escolhas nos eventos, clubes escolhidos, lesões e a idade.

Cada temporada é simulada partida a partida, e o resultado é uma história própria: anos de explosão, temporadas discretas, títulos, convocações, transferências, o declínio físico e, no fim, um resumo completo da carreira com uma nota de legado.

## Como funciona uma carreira

1. **Criação do jogador** — nome, nacionalidade, idade inicial (16 a 20 anos), posição, pé dominante e número da camisa.
2. **Draft** — uma rodada por atributo da posição (6 rodadas). Em cada rodada aparecem três lendas e você escolhe **um atributo** de uma delas. Cada atributo só pode ser preenchido uma vez; os que não forem escolhidos vêm da **academia** (valores entre 42 e 62).
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
- **Reroll**: **uma vez por carreira** é possível sortear novamente as opções da rodada atual. O uso fica salvo na carreira, e uma nova carreira começa com o reroll disponível.
- **Estilo de jogo** derivado dos atributos (por exemplo, Finalizador, Meia cerebral, Muralha, Goleiro-líbero).

### Carreira
- **40 ligas** em cinco continentes e **366 clubes** com força, reputação e nível salarial próprios.
- **Propostas de clubes** no início da carreira e ao fim de cada temporada, com titularidade esperada, exposição, chance de títulos e salário.
- **Transferências** com valor de mercado, salário semanal e **empréstimos** para jovens sem espaço no clube.
- **Números de camisa** por clube e seleção, com histórico.
- **28 eventos de carreira** (treinador, mercado, lesão, torcida, imprensa, seleção, vestiário etc.) com escolhas que afetam forma, titularidade, moral, risco de lesão e reputação.
- **Seleção nacional**: convocações, Datas FIFA, eliminatórias, liga das nações, Copa do Mundo e torneios continentais.
- **Competições de clubes**: liga, copa nacional, torneio continental e Mundial de Clubes.
- **Títulos e prêmios individuais**: artilheiro da liga, melhor goleiro, craque do clube, melhor jogador da liga, Prêmio Revelação Mundial, Coroa de Ouro FootRise e prêmios de torneios de seleções.
- **Reputação**, moral e confiança do treinador ao longo da carreira.
- **Aposentadoria** opcional a partir dos 34 anos e obrigatória aos 40.
- **Legado**: nota de 0 a 100 com detalhamento e classificação — PROMESSA, PROFISSIONAL, DESTAQUE, CRAQUE, LENDÁRIO ou ÍCONE.

### Histórico e interface
- **Minhas carreiras**: histórico de carreiras encerradas com resumo completo (temporada a temporada, clubes, troféus, prêmios, seleção, transferências, Pico de OVR, OVR final e atributos finais), ordenação por data ou legado e exclusão.
- Interface responsiva (celular, tablet e desktop) com opção de reduzir animações.

## OVR e evolução

O **OVR** (overall) é uma média ponderada dos seis atributos da posição, com pesos definidos em `src/config/positions.ts`. O mesmo conjunto de atributos vale um OVR diferente para um atacante e para um zagueiro.

O jogo trabalha com três leituras diferentes do OVR:

| Conceito | O que representa |
| --- | --- |
| **OVR ao longo da carreira** | O OVR atual do jogador, que muda ao fim de cada temporada conforme os atributos evoluem ou caem. Cada temporada registra o OVR inicial e o final. |
| **Pico de OVR** | O **maior overall atingido em toda a carreira**, junto com a temporada em que ele foi alcançado. É atualizado a cada temporada e nunca diminui. |
| **OVR final** | O overall no momento da aposentadoria, calculado a partir dos **atributos finais** — o estado real do jogador ao pendurar as chuteiras. |

Por isso um jogador pode ter Pico de OVR 96 e encerrar a carreira com OVR final 66: o pico mostra o auge, os atributos finais mostram o jogador veterano. O resumo da carreira exibe os dois valores separadamente, e resumos salvos por versões anteriores têm o pico reconstruído a partir das temporadas registradas.

**Evolução:** ao fim de cada temporada, cada atributo se aproxima do potencial definido no draft. A velocidade dessa aproximação depende de:

- **idade** — jovens evoluem mais rápido; o crescimento diminui progressivamente e cessa por volta dos 30 anos;
- **minutos jogados** — quem joga pouco evolui menos;
- **nota média** — boas temporadas aceleram a evolução;
- **nível da liga** — ligas mais fortes favorecem o desenvolvimento.

Temporadas excepcionais permitem **ultrapassar levemente o potencial**.

**Declínio:** a partir dos 30 anos (32 para goleiros) os atributos começam a cair, cada um em ritmo próprio — velocidade e físico caem mais rápido, passe e jogo com os pés mais devagar. A perda aumenta a cada ano, e bom desempenho ameniza a queda.

## Simulação de temporadas

Cada temporada é simulada **partida a partida**, com um modelo de Poisson para os placares: liga, copa nacional, competição continental (quando o clube se classifica), Mundial de Clubes e jogos da seleção. A cada partida o jogo decide se o jogador é titular, entra no decorrer do jogo ou fica de fora, e registra gols, assistências, nota, minutos, cartões, lesões e estatísticas detalhadas (finalizações, passes decisivos, desarmes, interceptações, cortes, defesas e gols sofridos).

O desempenho é influenciado por:

- **Atributos** — finalização, acesso às chances (velocidade, drible, físico) e criação definem a participação nos gols do time; defesa e físico definem as ações defensivas; atributos de goleiro definem o aproveitamento de defesas.
- **Posição** — cada posição tem um perfil estatístico próprio: atacantes marcam mais, meias criam mais, zagueiros e volantes defendem mais e goleiros têm estatísticas específicas.
- **Força do clube e dos adversários** — times mais fortes criam e marcam mais; adversários mais fortes reduzem a produção ofensiva e aumentam a carga defensiva. O nível do jogador em relação ao elenco também influencia a titularidade e a participação.
- **Minutos e titularidade** — dependem do overall em relação ao elenco, da confiança do treinador e da posição. A produção é proporcional ao tempo em campo.
- **Forma** — cada temporada sorteia uma forma (influenciada pela moral e pelos eventos), que pode gerar anos excelentes, normais ou abaixo do esperado. Durante a temporada, sequências de boas ou más atuações também pesam.
- **Idade** — além da evolução e do declínio, jogadores mais velhos têm mais risco de lesão.
- **Lesões e suspensões** — lesões leves, musculares ou graves e cartões reduzem as partidas disponíveis.
- **Eventos de carreira** — as decisões tomadas nos eventos alteram forma, moral, titularidade e risco de lesão.

**Objetivo do balanceamento:** jogadores de maior qualidade têm, em média, números claramente melhores e potencial para temporadas históricas, mas a produção tem retorno decrescente no topo e as temporadas variam naturalmente. Um craque pode dominar um ano e ter um ano apenas bom no seguinte — o resultado não é determinado só pelo overall.

Todos os parâmetros de balanceamento ficam em `src/config/balance.ts`, e os perfis por posição em `src/config/positions.ts`. O gerador aleatório tem seed salva na carreira, então os resultados são reproduzíveis.

## Transferências e mercado

### Primeiro contrato
A carreira começa com **três propostas de clubes do país do jogador**, com perfis distintos: uma opção segura (protagonismo), uma intermediária (equilíbrio) e uma ambiciosa (clube mais forte, mais vitrine e mais disputa por posição).

### Propostas de fim de temporada
- Os clubes interessados são escolhidos pela **força próxima ao nível do jogador**, ajustada pelo **desempenho na temporada e pela reputação** — boas temporadas atraem clubes maiores e mais propostas.
- Cada proposta mostra **valor de transferência**, **salário semanal**, **titularidade esperada**, exposição e chance de títulos. Clubes bem mais fortes que o atual aparecem destacados como "gigantes".
- O **valor de mercado** depende do OVR, da idade e da reputação; o salário depende também do nível salarial da liga.
- Eventos de carreira podem gerar uma **promessa de interesse** de um clube, que vira proposta ao fim da temporada.
- Jogadores de até 21 anos com pouco espaço no clube podem receber **propostas de empréstimo** de uma temporada.
- A partir dos 33 anos o número de propostas diminui, e jogadores com OVR abaixo de 62 nessa idade deixam de receber propostas (permanecem no clube).

### Mercado de fim de carreira
Quando o jogador entra em declínio, o mercado muda. O declínio não é medido só pela idade: ele combina **idade (a partir dos 30)**, **distância para o Pico de OVR**, **queda de OVR na última temporada** e **nota**. Um veterano que mantém o nível continua com o mercado normal.

Em declínio:
- cresce a chance de as propostas virem de **clubes do país do jogador**, desde que o nível do clube seja compatível com o do jogador — quem joga no exterior pode receber o convite para voltar para casa;
- o **clube onde o jogador surgiu** (o do primeiro contrato) pode fazer uma proposta para trazê-lo de volta. A chance aumenta com o declínio e diminui quanto maior a diferença de nível entre o clube e o jogador — nunca é garantida.

### Histórico de transferências
Todas as transferências e empréstimos ficam registrados com temporada, clube de origem, clube de destino e valor, e aparecem no resumo da carreira.

## Final da carreira e legado

- **Envelhecimento:** a partir dos 30 anos (32 para goleiros) os atributos caem a cada temporada, e o OVR acompanha essa queda.
- **Mercado:** o declínio altera o perfil das propostas (veja [Mercado de fim de carreira](#mercado-de-fim-de-carreira)) e, com a idade e o OVR baixo, as propostas podem desaparecer.
- **Aposentadoria:** a partir dos 34 anos o jogador pode anunciar a aposentadoria para o fim da temporada ou se aposentar imediatamente; aos 40 ela é obrigatória.
- **Resumo da carreira:** clubes e passagens, temporada a temporada, troféus, prêmios, seleção, transferências, números de camisa, ganhos, estatísticas totais, **Pico de OVR**, **OVR final** e **atributos finais**.
- **Legado:** nota de 0 a 100 composta por pico de overall, títulos, títulos gigantes, produção em campo, prêmios individuais, longevidade, seleção, nível dos clubes e consistência — com o detalhamento de cada componente e a classificação final.

## Contas, autenticação e salvamento

- **Neste navegador (sempre):** a carreira ativa é salva no `localStorage` a cada ação, e as carreiras encerradas salvas no histórico também ficam guardadas no navegador. O jogo funciona por completo sem conta.
- **Na nuvem (opcional):** com o Firebase configurado, o jogador pode criar uma conta com **nome de usuário, e-mail e senha** (Firebase Authentication, e-mail/senha). Também há login, logout e recuperação de senha por e-mail.
- **Perfil:** o nome de usuário escolhido no cadastro é salvo no perfil do Cloud Firestore e exibido como nome da conta, com o e-mail abaixo dele.
- **Sincronização:** para usuários autenticados, a carreira ativa é enviada automaticamente para o Cloud Firestore, e as carreiras encerradas salvas ficam no histórico da conta. Ao entrar na conta em outro navegador ou dispositivo, a carreira da nuvem é carregada. Se a cópia local e a da nuvem divergirem, o jogo pergunta qual manter — nada é sobrescrito sem confirmação.
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
                mercado, propostas, seleção, prêmios, eventos, legado, resumo e orquestração da carreira
  state/        persistência local, sincronização com a nuvem e contexto React
  ui/           componentes e telas
  styles/       estilos globais
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

Sem variáveis de ambiente o jogo roda normalmente, só com salvamento local. Para habilitar contas e nuvem, veja [Variáveis de ambiente](#variáveis-de-ambiente) e [Firebase](#firebase).

O build usa caminhos relativos e pode ser hospedado em qualquer serviço de arquivos estáticos.

## Variáveis de ambiente

As variáveis seguem o modelo de `.env.example`. Copie-o para `.env.local` e preencha com os dados do app Web do seu projeto Firebase:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
```

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_APP_ID` são obrigatórias para ativar a nuvem.
- `VITE_FIREBASE_USE_EMULATOR=true` (opcional) aponta o app para o Firebase Emulator Suite local.

Arquivos `.env` e `*.local` estão no `.gitignore`. **Nunca faça commit de credenciais.**

## Firebase

As contas e o salvamento em nuvem dependem de um projeto Firebase próprio. As credenciais **não fazem parte do repositório** e devem ser configuradas localmente:

1. No [Console do Firebase](https://console.firebase.google.com/), crie um projeto com um app Web, habilite **Authentication → E-mail/senha** e crie o **Cloud Firestore**.
2. Em **Configurações do projeto → Seus apps → Web**, copie os dados do app para o `.env.local` (veja [Variáveis de ambiente](#variáveis-de-ambiente)).
3. Publique as regras de segurança:

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

**Desenvolvimento sem projeto real:** `npm run emulators` sobe Auth e Firestore locais com um projeto de demonstração. Para apontar o app para eles, use as variáveis de exemplo comentadas no `.env.example` (incluindo `VITE_FIREBASE_USE_EMULATOR=true`).

## Testes

```bash
npm test             # testes do motor e do estado (Vitest)
npm run typecheck    # verificação de tipos (tsc --noEmit)
npm run test:cloud   # regras do Firestore + serviço de nuvem no Firebase Emulator Suite (requer Java)
npm run test:watch   # Vitest em modo watch
```

Os testes cobrem overall, draft e reroll, simulação e estatísticas por nível e posição, evolução, Pico de OVR e OVR final, transferências (incluindo o mercado de fim de carreira), seleção, aposentadoria, legado, persistência local, sincronização e, no emulador, cadastro, login, perfil, regras de segurança e salvamento na nuvem.

## Desenvolvimento

```bash
npm run dev          # desenvolvimento com recarregamento automático
npm run test:watch   # testes rodando a cada alteração
npm run emulators    # Auth + Firestore locais
```

Ajustes de jogabilidade normalmente ficam restritos a `src/config/balance.ts` e `src/config/positions.ts`.

## Status do projeto

O FootRise está em desenvolvimento ativo e já é jogável de ponta a ponta: criação, draft, carreira completa, mercado de transferências, seleção, aposentadoria, legado, histórico e salvamento local ou em nuvem estão implementados e cobertos por testes. Não há ranking global nem compartilhamento de carreiras entre usuários.

## Próximos passos

> Melhoria planejada — **ainda não implementada**.

- **Economia de transferências:** refinar os valores pagos nas transferências para que fiquem mais coerentes com a força e a capacidade financeira de cada clube. Hoje o valor da transferência é calculado a partir do valor de mercado do jogador (OVR, idade e reputação), sem considerar o poder financeiro do clube comprador.

## Aviso

Nomes de jogadores reais aparecem apenas como referência esportiva no draft. Os atributos das lendas são estimativas próprias do jogo, não dados oficiais. Clubes reais aparecem apenas pelo nome, com escudos estilizados gerados pelo jogo (sem escudos ou marcas oficiais), e as competições continentais e os prêmios individuais têm nomes próprios do FootRise.

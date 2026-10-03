# FootRise

> Monte um jogador impossível com o DNA de lendas. Viva a carreira. Construa um legado.

**FootRise** é um jogo de navegador de futebol focado em criação de jogador, draft de atributos e carreira simulada. Uma carreira completa leva poucos minutos — e sempre dá vontade de fazer "só mais uma".

## Conceito

1. **Crie o jogador** — nome, nacionalidade, idade (16–20), posição, pé e número.
2. **Draft de lendas** — 8 rodadas. Em cada uma, três lendas aparecem e você rouba **um atributo** de uma delas (a velocidade de um, a finalização de outro...). A posição define quanto cada atributo pesa, e slots não preenchidos vêm da academia (42–62). Pegar um atributo já preenchido substitui o anterior.
3. **A carta** — o draft define o seu **potencial**. Você começa abaixo dele e a carreira decide quanto do teto vai alcançar.
4. **Carreira** — escolha clubes (titularidade × vitrine × salário), tome decisões antes de cada temporada e simule jogo a jogo: gols, assistências, notas, lesões, cartões, títulos, seleção e prêmios.
5. **Mercado** — propostas, grandes clubes, empréstimos para jovens sem espaço.
6. **Legado** — ao se aposentar, a carreira recebe uma nota de 0 a 100 e uma classificação: PROMESSA, PROFISSIONAL, DESTAQUE, CRAQUE, LENDÁRIO ou ÍCONE.

Inspirado conceitualmente em jogos do gênero (como Copero e The Phenomenon), com sistemas, textos e visual próprios.

## Funcionalidades

- Draft com 108 lendas de várias posições, eras e países; modo **Analista** (números visíveis, impacto no potencial) e **Instinto** (números ocultos).
- Pesos de overall por posição, com tratamento próprio para goleiros (Elasticidade, Manuseio, Reflexos, Posicionamento, Jogo com os pés, Físico).
- Estilo de jogo derivado dos atributos (Finalizador, Meia cerebral, Muralha, Goleiro-líbero...).
- 11 ligas e 84 clubes fictícios com força, reputação e salários diferentes.
- Simulação partida a partida (modelo de Poisson): liga, copa nacional, competição continental, Mundial de Clubes.
- Evolução por idade, minutos, desempenho e nível da liga; pico e declínio.
- 16 eventos de carreira com consequências reais (mudança de posição, lesão, torcida, imprensa, mentor, patrocínio, capitania...).
- Seleção nacional: convocações, eliminatórias, Copa do Mundo e torneios continentais.
- Prêmios: artilheiro, melhor goleiro, craque do clube, melhor da liga, revelação e a Coroa de Ouro FootRise.
- Salvamento automático (localStorage) e, opcionalmente, na nuvem (Firebase); histórico de carreiras encerradas com resumo completo.
- Interface responsiva (celular, tablet, desktop), animações leves e opção de reduzir animações.

## Tecnologias

- React 19 + TypeScript
- Vite
- CSS próprio (sem framework de UI)
- Vitest para os testes do motor

Sem backend: tudo roda no navegador.

## Como executar

Requisitos: Node.js 18+ (testado com Node 22).

```bash
npm install
npm run dev        # servidor local (http://localhost:5173)
npm test           # testes do motor
npm run typecheck  # verificação de tipos
npm run build      # build de produção em dist/
npm run preview    # serve o build
```

O build usa caminhos relativos e pode ser hospedado em qualquer serviço estático (GitHub Pages, Netlify, Vercel...).

## Salvamento e nuvem

- **Neste navegador (sempre):** a carreira ativa é salva inteira no `localStorage` a cada ação. Carreiras encerradas viram um resumo completo em "Minhas carreiras" quando você escolhe **Salvar carreira**.
- **Na nuvem (opcional, Firebase):** com conta (e-mail, nome de usuário e senha), a carreira ativa é sincronizada automaticamente e o histórico fica na conta. Se as duas cópias divergirem, o jogo pergunta qual manter — nada é sobrescrito sem confirmação.

Para ativar a nuvem: copie `.env.example` para `.env.local` e preencha com o app Web do seu projeto Firebase (Authentication por e-mail/senha + Cloud Firestore). Publique as regras com `npx firebase-tools deploy --only firestore:rules`.

```bash
npm run emulators   # Auth + Firestore locais (projeto demo, sem credenciais)
npm run test:cloud  # regras do Firestore + serviço de nuvem contra o emulador (requer Java)
```

## Estrutura

```
src/
  config/     pesos por posição e parâmetros de balanceamento (sem números mágicos espalhados)
  data/       lendas, países, ligas, clubes e eventos
  engine/     motor puro: overall, draft, partida, temporada, evolução,
              mercado, seleção, prêmios, legado e orquestração da carreira
  state/      persistência (localStorage com validação) e contexto React
  ui/         componentes e telas
  types.ts    tipos de domínio
```

O motor não depende do React. Cada ação (`draftPick`, `startSeason`, `acceptOffer`...) recebe uma carreira e devolve uma nova. O estado do gerador aleatório (com seed) fica salvo na carreira, então os resultados são reproduzíveis.

O balanceamento fica em `src/config/balance.ts` e os pesos de overall em `src/config/positions.ts`.

## Próximos passos

- Compartilhar carreira / códigos de seed
- Desafios e modos de draft alternativos
- Mais ligas, clubes, lendas e eventos
- Comparação entre jogadores do histórico
- Ranking e contas (exigiriam backend)

## Aviso

Nomes de jogadores reais aparecem apenas como referência esportiva no draft. Os atributos são estimativas próprias do jogo, e não há imagens, escudos ou marcas de terceiros. Clubes e prêmios são fictícios.

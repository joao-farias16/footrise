import type { Confederation, Country } from '../types';

type Row = [code: string, name: string, strength: number, confed: Confederation, flag: string[], dir?: 'h' | 'v'];

const ROWS: Row[] = [
  ['BRA', 'Brasil', 88, 'CONMEBOL', ['#0b9a3c', '#ffd400', '#1b3c8f'], 'h'],
  ['ARG', 'Argentina', 89, 'CONMEBOL', ['#74acdf', '#ffffff', '#74acdf'], 'h'],
  ['FRA', 'França', 89, 'UEFA', ['#1f3a93', '#ffffff', '#e1262d'], 'v'],
  ['ENG', 'Inglaterra', 87, 'UEFA', ['#ffffff', '#cf142b', '#ffffff'], 'v'],
  ['ESP', 'Espanha', 88, 'UEFA', ['#c60b1e', '#ffc400', '#c60b1e'], 'h'],
  ['GER', 'Alemanha', 86, 'UEFA', ['#111111', '#dd0000', '#ffce00'], 'h'],
  ['POR', 'Portugal', 86, 'UEFA', ['#046a38', '#da291c', '#da291c'], 'v'],
  ['ITA', 'Itália', 84, 'UEFA', ['#009246', '#ffffff', '#ce2b37'], 'v'],
  ['NED', 'Holanda', 84, 'UEFA', ['#ae1c28', '#ffffff', '#21468b'], 'h'],
  ['BEL', 'Bélgica', 82, 'UEFA', ['#111111', '#fdda24', '#ef3340'], 'v'],
  ['CRO', 'Croácia', 81, 'UEFA', ['#ff0000', '#ffffff', '#171796'], 'h'],
  ['URU', 'Uruguai', 80, 'CONMEBOL', ['#ffffff', '#0038a8', '#ffffff', '#0038a8'], 'h'],
  ['COL', 'Colômbia', 79, 'CONMEBOL', ['#fcd116', '#fcd116', '#003893', '#ce1126'], 'h'],
  ['MAR', 'Marrocos', 80, 'CAF', ['#c1272d', '#006233', '#c1272d'], 'h'],
  ['DEN', 'Dinamarca', 79, 'UEFA', ['#c8102e', '#ffffff', '#c8102e'], 'v'],
  ['SUI', 'Suíça', 78, 'UEFA', ['#d52b1e', '#ffffff', '#d52b1e'], 'h'],
  ['SEN', 'Senegal', 78, 'CAF', ['#00853f', '#fdef42', '#e31b23'], 'v'],
  ['USA', 'Estados Unidos', 76, 'CONCACAF', ['#b22234', '#ffffff', '#3c3b6e'], 'h'],
  ['MEX', 'México', 76, 'CONCACAF', ['#006847', '#ffffff', '#ce1126'], 'v'],
  ['JPN', 'Japão', 77, 'AFC', ['#ffffff', '#bc002d', '#ffffff'], 'v'],
  ['KOR', 'Coreia do Sul', 75, 'AFC', ['#ffffff', '#cd2e3a', '#0047a0'], 'h'],
  ['NOR', 'Noruega', 76, 'UEFA', ['#ba0c2f', '#ffffff', '#00205b'], 'v'],
  ['POL', 'Polônia', 75, 'UEFA', ['#ffffff', '#dc143c'], 'h'],
  ['SWE', 'Suécia', 75, 'UEFA', ['#006aa7', '#fecc02', '#006aa7'], 'h'],
  ['NGA', 'Nigéria', 75, 'CAF', ['#008751', '#ffffff', '#008751'], 'v'],
  ['CIV', 'Costa do Marfim', 76, 'CAF', ['#f77f00', '#ffffff', '#009e60'], 'v'],
  ['EGY', 'Egito', 73, 'CAF', ['#ce1126', '#ffffff', '#111111'], 'h'],
  ['CHI', 'Chile', 73, 'CONMEBOL', ['#ffffff', '#d52b1e'], 'h'],
  ['ECU', 'Equador', 75, 'CONMEBOL', ['#ffdd00', '#ffdd00', '#034ea2', '#ed1c24'], 'h'],
  ['PAR', 'Paraguai', 71, 'CONMEBOL', ['#d52b1e', '#ffffff', '#0038a8'], 'h'],
  ['CAN', 'Canadá', 73, 'CONCACAF', ['#d52b1e', '#ffffff', '#d52b1e'], 'v'],
  ['AUS', 'Austrália', 72, 'AFC', ['#012169', '#e4002b', '#012169'], 'h'],
  ['KSA', 'Arábia Saudita', 70, 'AFC', ['#006c35', '#ffffff', '#006c35'], 'h'],
  ['UKR', 'Ucrânia', 74, 'UEFA', ['#0057b7', '#ffd700'], 'h'],
  ['CZE', 'Tchéquia', 73, 'UEFA', ['#ffffff', '#d7141a'], 'h'],
  ['SVN', 'Eslovênia', 70, 'UEFA', ['#ffffff', '#0000ff', '#ff0000'], 'h'],
  ['IRL', 'Irlanda', 70, 'UEFA', ['#169b62', '#ffffff', '#ff883e'], 'v'],
  ['NIR', 'Irlanda do Norte', 66, 'UEFA', ['#ffffff', '#cc0000', '#ffffff'], 'h'],
  ['BUL', 'Bulgária', 70, 'UEFA', ['#ffffff', '#00966e', '#d62612'], 'h'],
  ['TUR', 'Turquia', 77, 'UEFA', ['#e30a17', '#ffffff', '#e30a17'], 'v'],
  ['SCO', 'Escócia', 73, 'UEFA', ['#005eb8', '#ffffff', '#005eb8'], 'h'],
  ['URS', 'União Soviética', 80, 'UEFA', ['#cc0000', '#cc0000', '#ffd700'], 'h'],
];

/** Países históricos que existem apenas como origem de lendas. */
const NOT_SELECTABLE = new Set(['URS']);

export const COUNTRIES: Country[] = ROWS.map(([code, name, strength, confed, flag, flagDir]) => ({
  code,
  name,
  strength,
  confed,
  flag,
  flagDir,
}));

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export const SELECTABLE_COUNTRIES = COUNTRIES.filter((c) => !NOT_SELECTABLE.has(c.code)).sort((a, b) =>
  a.name.localeCompare(b.name, 'pt-BR'),
);

export function getCountry(code: string): Country {
  return COUNTRY_BY_CODE[code] ?? COUNTRY_BY_CODE.BRA;
}

/** Nome do torneio continental de seleções por confederação. */
export const CONTINENTAL_NATION_CUP: Record<Confederation, string> = {
  UEFA: 'Eurocopa',
  CONMEBOL: 'Copa América',
  CAF: 'Copa Africana de Nações',
  AFC: 'Copa da Ásia',
  CONCACAF: 'Copa Ouro',
};

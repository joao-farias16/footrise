import type { Legend, PositionId } from '../types';

// Banco de lendas usadas no draft. Os valores são estimativas próprias do FootRise
// (escala 0–99) para fins de jogo, não dados oficiais.

type OutfieldRow = [name: string, country: string, pos: PositionId, era: string, stats: [number, number, number, number, number, number], style: string];
// [pac, sho, pas, dri, def, phy]
const OUTFIELD: OutfieldRow[] = [
  // Atacantes
  ['Pelé', 'BRA', 'ATA', 'Anos 60', [92, 96, 89, 95, 46, 81], 'Rei completo'],
  ['Ronaldo Nazário', 'BRA', 'ATA', 'Anos 90', [97, 95, 79, 96, 30, 85], 'Fenômeno explosivo'],
  ['Cristiano Ronaldo', 'POR', 'ATA', 'Anos 2010', [93, 97, 82, 89, 35, 89], 'Máquina de gols'],
  ['Mbappé', 'FRA', 'ATA', 'Anos 2020', [98, 91, 81, 93, 36, 80], 'Velocista letal'],
  ['Haaland', 'NOR', 'ATA', 'Anos 2020', [89, 95, 66, 78, 45, 93], 'Centroavante colosso'],
  ['Romário', 'BRA', 'ATA', 'Anos 90', [88, 95, 76, 92, 25, 63], 'Matador de área'],
  ['Thierry Henry', 'FRA', 'ATA', 'Anos 2000', [94, 91, 84, 91, 38, 80], 'Elegância veloz'],
  ['Van Basten', 'NED', 'ATA', 'Anos 80', [82, 95, 81, 89, 40, 84], 'Finalizador artístico'],
  ['Gerd Müller', 'GER', 'ATA', 'Anos 70', [76, 96, 69, 81, 35, 80], 'Faro de gol'],
  ['Eusébio', 'POR', 'ATA', 'Anos 60', [92, 94, 79, 90, 40, 82], 'Pantera negra'],
  ['Lewandowski', 'POL', 'ATA', 'Anos 2010', [79, 94, 80, 86, 44, 84], 'Centroavante clínico'],
  ['Ibrahimović', 'SWE', 'ATA', 'Anos 2010', [74, 92, 84, 88, 40, 91], 'Gigante técnico'],
  ['Benzema', 'FRA', 'ATA', 'Anos 2010', [80, 90, 86, 88, 38, 79], 'Nove associativo'],
  ['Luis Suárez', 'URU', 'ATA', 'Anos 2010', [82, 93, 84, 87, 50, 82], 'Atacante incansável'],
  ['Batistuta', 'ARG', 'ATA', 'Anos 90', [83, 94, 70, 80, 38, 88], 'Chute de canhão'],
  ['Shevchenko', 'UKR', 'ATA', 'Anos 2000', [88, 92, 77, 86, 40, 80], 'Atacante moderno'],
  ['Drogba', 'CIV', 'ATA', 'Anos 2000', [82, 89, 72, 80, 44, 94], 'Força de decisão'],
  ['Harry Kane', 'ENG', 'ATA', 'Anos 2020', [70, 94, 88, 82, 48, 85], 'Nove criador'],
  ['Adriano', 'BRA', 'ATA', 'Anos 2000', [84, 92, 72, 85, 35, 92], 'Imperador canhoto'],
  // Pontas
  ['Garrincha', 'BRA', 'PD', 'Anos 60', [93, 82, 80, 98, 30, 66], 'Alegria do povo'],
  ['Neymar', 'BRA', 'PE', 'Anos 2010', [91, 88, 87, 97, 32, 62], 'Driblador ousado'],
  ['Messi', 'ARG', 'PD', 'Anos 2010', [89, 94, 95, 99, 35, 68], 'Gênio canhoto'],
  ['Robben', 'NED', 'PD', 'Anos 2010', [92, 89, 81, 92, 33, 68], 'Corte para dentro'],
  ['Salah', 'EGY', 'PD', 'Anos 2020', [93, 90, 82, 89, 42, 76], 'Ponta artilheiro'],
  ['Vinícius Jr.', 'BRA', 'PE', 'Anos 2020', [97, 85, 80, 93, 30, 70], 'Ponta elétrico'],
  ['Ribéry', 'FRA', 'PE', 'Anos 2010', [89, 82, 86, 93, 38, 68], 'Ponta insistente'],
  ['Figo', 'POR', 'PD', 'Anos 2000', [85, 82, 89, 91, 45, 75], 'Ponta criativo'],
  ['Hazard', 'BEL', 'PE', 'Anos 2010', [90, 83, 86, 95, 33, 68], 'Condução hipnótica'],
  ['George Best', 'NIR', 'PD', 'Anos 60', [91, 87, 80, 95, 40, 70], 'Quinto Beatle'],
  ['Lamine Yamal', 'ESP', 'PD', 'Anos 2020', [86, 82, 88, 93, 30, 58], 'Prodígio precoce'],
  ['Stoichkov', 'BUL', 'PE', 'Anos 90', [88, 89, 82, 88, 40, 78], 'Canhota explosiva'],
  // Meias
  ['Zidane', 'FRA', 'MEI', 'Anos 2000', [78, 87, 93, 96, 55, 83], 'Maestro elegante'],
  ['Maradona', 'ARG', 'MEI', 'Anos 80', [88, 92, 92, 99, 35, 73], 'Gênio rebelde'],
  ['Cruyff', 'NED', 'MEI', 'Anos 70', [90, 90, 91, 96, 40, 72], 'Futebol total'],
  ['Platini', 'FRA', 'MEI', 'Anos 80', [76, 92, 93, 88, 40, 70], 'Meia artilheiro'],
  ['Zico', 'BRA', 'MEI', 'Anos 80', [83, 92, 92, 93, 35, 66], 'Galinho das faltas'],
  ['Kaká', 'BRA', 'MEI', 'Anos 2000', [93, 88, 88, 91, 40, 80], 'Arrancada vertical'],
  ['Ronaldinho', 'BRA', 'MEI', 'Anos 2000', [86, 87, 92, 98, 35, 76], 'Mágico do sorriso'],
  ['Iniesta', 'ESP', 'MEI', 'Anos 2010', [77, 75, 93, 96, 58, 64], 'Controle absoluto'],
  ['Xavi', 'ESP', 'MEI', 'Anos 2010', [70, 72, 98, 91, 64, 63], 'Cérebro do passe'],
  ['Modrić', 'CRO', 'MEI', 'Anos 2010', [75, 77, 94, 92, 68, 68], 'Maestro incansável'],
  ['De Bruyne', 'BEL', 'MEI', 'Anos 2020', [76, 88, 96, 87, 60, 78], 'Passe cirúrgico'],
  ['Gerrard', 'ENG', 'MEI', 'Anos 2000', [79, 89, 90, 82, 72, 85], 'Box-to-box líder'],
  ['Lampard', 'ENG', 'MEI', 'Anos 2000', [72, 90, 87, 80, 64, 79], 'Meia goleador'],
  ['Pirlo', 'ITA', 'MEI', 'Anos 2010', [62, 79, 97, 88, 62, 64], 'Arquiteto'],
  ['Rivaldo', 'BRA', 'MEI', 'Anos 2000', [82, 90, 86, 91, 38, 79], 'Canhota decisiva'],
  ['Roberto Baggio', 'ITA', 'MEI', 'Anos 90', [82, 92, 88, 94, 30, 64], 'Rabo de cavalo divino'],
  ['Totti', 'ITA', 'MEI', 'Anos 2000', [76, 91, 92, 89, 40, 80], 'Capitão eterno'],
  ['Michael Laudrup', 'DEN', 'MEI', 'Anos 90', [84, 82, 93, 94, 35, 68], 'Visão de jogo'],
  ['Bellingham', 'ENG', 'MEI', 'Anos 2020', [80, 85, 85, 87, 74, 87], 'Meia completo'],
  ['Sócrates', 'BRA', 'MEI', 'Anos 80', [72, 87, 92, 87, 50, 76], 'Doutor do calcanhar'],
  ['Pedri', 'ESP', 'MEI', 'Anos 2020', [76, 74, 91, 92, 62, 66], 'Toque refinado'],
  // Volantes
  ['Matthäus', 'GER', 'VOL', 'Anos 90', [80, 84, 86, 82, 85, 84], 'Volante total'],
  ['Busquets', 'ESP', 'VOL', 'Anos 2010', [55, 60, 91, 82, 85, 75], 'Posicionamento perfeito'],
  ['Makélélé', 'FRA', 'VOL', 'Anos 2000', [74, 54, 80, 76, 90, 82], 'Escudo da zaga'],
  ['Vieira', 'FRA', 'VOL', 'Anos 2000', [78, 70, 84, 80, 88, 92], 'Motor de meio-campo'],
  ['Rodri', 'ESP', 'VOL', 'Anos 2020', [62, 76, 91, 80, 87, 86], 'Controle de ritmo'],
  ['Kanté', 'FRA', 'VOL', 'Anos 2010', [81, 66, 78, 81, 90, 82], 'Pulmão infinito'],
  ['Casemiro', 'BRA', 'VOL', 'Anos 2010', [66, 72, 80, 72, 88, 90], 'Cão de guarda'],
  ['Roy Keane', 'IRL', 'VOL', 'Anos 90', [72, 70, 82, 74, 87, 90], 'Liderança feroz'],
  ['Gattuso', 'ITA', 'VOL', 'Anos 2000', [74, 58, 70, 66, 89, 88], 'Raça pura'],
  ['Falcão', 'BRA', 'VOL', 'Anos 80', [74, 80, 91, 85, 78, 76], 'Rei de Roma'],
  ['Schweinsteiger', 'GER', 'VOL', 'Anos 2010', [70, 80, 88, 82, 82, 84], 'Comandante'],
  // Zagueiros
  ['Beckenbauer', 'GER', 'ZAG', 'Anos 70', [78, 70, 91, 86, 93, 82], 'Kaiser líbero'],
  ['Baresi', 'ITA', 'ZAG', 'Anos 90', [74, 48, 82, 74, 97, 80], 'Muralha tática'],
  ['Cannavaro', 'ITA', 'ZAG', 'Anos 2000', [82, 45, 75, 72, 95, 84], 'Antecipação'],
  ['Sergio Ramos', 'ESP', 'ZAG', 'Anos 2010', [82, 70, 77, 74, 92, 88], 'Zagueiro decisivo'],
  ['Van Dijk', 'NED', 'ZAG', 'Anos 2020', [80, 60, 80, 72, 94, 93], 'Zagueiro dominante'],
  ['Puyol', 'ESP', 'ZAG', 'Anos 2010', [76, 45, 72, 66, 92, 87], 'Coração valente'],
  ['Nesta', 'ITA', 'ZAG', 'Anos 2000', [80, 40, 76, 70, 95, 84], 'Desarme limpo'],
  ['Thiago Silva', 'BRA', 'ZAG', 'Anos 2010', [74, 50, 80, 72, 93, 82], 'Monstro técnico'],
  ['Lúcio', 'BRA', 'ZAG', 'Anos 2000', [82, 58, 70, 70, 90, 90], 'Zagueiro arrancador'],
  ['Hummels', 'GER', 'ZAG', 'Anos 2010', [66, 58, 85, 72, 91, 83], 'Saída de bola'],
  ['Elías Figueroa', 'CHI', 'ZAG', 'Anos 70', [76, 48, 76, 70, 93, 85], 'Elegância defensiva'],
  ['John Terry', 'ENG', 'ZAG', 'Anos 2000', [64, 58, 72, 62, 93, 88], 'Capitão de área'],
  // Laterais
  ['Maldini', 'ITA', 'LE', 'Anos 90', [85, 50, 78, 72, 96, 85], 'Defensor perfeito'],
  ['Cafu', 'BRA', 'LD', 'Anos 2000', [91, 66, 82, 82, 87, 86], 'Pendolino'],
  ['Roberto Carlos', 'BRA', 'LE', 'Anos 2000', [93, 84, 84, 84, 82, 84], 'Chute impossível'],
  ['Marcelo', 'BRA', 'LE', 'Anos 2010', [84, 74, 87, 90, 76, 76], 'Lateral meia'],
  ['Daniel Alves', 'BRA', 'LD', 'Anos 2010', [86, 72, 89, 86, 80, 76], 'Lateral criativo'],
  ['Philipp Lahm', 'GER', 'LD', 'Anos 2010', [80, 60, 87, 83, 90, 70], 'Inteligência pura'],
  ['Zanetti', 'ARG', 'LD', 'Anos 2000', [83, 60, 82, 80, 89, 85], 'Trator incansável'],
  ['Nílton Santos', 'BRA', 'LE', 'Anos 60', [84, 60, 82, 80, 90, 80], 'Enciclopédia'],
  ['Alexander-Arnold', 'ENG', 'LD', 'Anos 2020', [76, 74, 93, 80, 76, 72], 'Lateral armador'],
  ['Ashley Cole', 'ENG', 'LE', 'Anos 2000', [87, 50, 80, 80, 89, 75], 'Marcação implacável'],
  ['Alphonso Davies', 'CAN', 'LE', 'Anos 2020', [97, 66, 78, 85, 76, 76], 'Foguete na lateral'],
  ['Hakimi', 'MAR', 'LD', 'Anos 2020', [95, 74, 80, 84, 78, 78], 'Ala supersônico'],
  ['Facchetti', 'ITA', 'LE', 'Anos 70', [82, 70, 78, 74, 88, 85], 'Lateral pioneiro'],
];

type KeeperRow = [name: string, country: string, era: string, stats: [number, number, number, number, number, number], style: string];
// [div, han, ref, gkp, kic, phy]
const KEEPERS: KeeperRow[] = [
  ['Yashin', 'URS', 'Anos 60', [90, 90, 92, 91, 70, 85], 'Aranha negra'],
  ['Buffon', 'ITA', 'Anos 2000', [89, 90, 92, 95, 72, 84], 'Longevidade lendária'],
  ['Casillas', 'ESP', 'Anos 2010', [91, 85, 95, 87, 70, 74], 'Reflexo de santo'],
  ['Neuer', 'GER', 'Anos 2010', [88, 89, 90, 92, 92, 86], 'Goleiro-líbero'],
  ['Oliver Kahn', 'GER', 'Anos 2000', [90, 88, 92, 89, 66, 90], 'Titã'],
  ['Schmeichel', 'DEN', 'Anos 90', [92, 85, 92, 87, 75, 88], 'Estrela-do-mar'],
  ['Taffarel', 'BRA', 'Anos 90', [87, 84, 89, 86, 68, 76], 'Pegador de pênaltis'],
  ['Courtois', 'BEL', 'Anos 2020', [86, 89, 90, 92, 72, 86], 'Envergadura'],
  ['Alisson', 'BRA', 'Anos 2020', [88, 88, 89, 90, 88, 84], 'Calma absoluta'],
  ['Ederson', 'BRA', 'Anos 2020', [84, 82, 86, 84, 95, 80], 'Lançamento preciso'],
  ['Gordon Banks', 'ENG', 'Anos 60', [90, 90, 90, 90, 64, 80], 'Defesa do século'],
  ['Dino Zoff', 'ITA', 'Anos 80', [85, 92, 86, 92, 66, 80], 'Serenidade'],
  ['Van der Sar', 'NED', 'Anos 2000', [83, 88, 86, 90, 88, 82], 'Goleiro moderno'],
  ['Petr Čech', 'CZE', 'Anos 2000', [85, 90, 88, 90, 70, 86], 'Muralha de capacete'],
  ['Oblak', 'SVN', 'Anos 2020', [89, 90, 90, 89, 70, 82], 'Muro esloveno'],
  ['Dida', 'BRA', 'Anos 2000', [88, 84, 87, 84, 66, 86], 'Gigante silencioso'],
  ['Rogério Ceni', 'BRA', 'Anos 2000', [80, 82, 84, 86, 90, 78], 'Goleiro artilheiro'],
  ['Chilavert', 'PAR', 'Anos 90', [82, 84, 84, 85, 88, 85], 'Goleiro cobrador'],
  ['Higuita', 'COL', 'Anos 90', [84, 70, 86, 72, 88, 74], 'Escorpião'],
  ['Emiliano Martínez', 'ARG', 'Anos 2020', [87, 84, 89, 85, 75, 85], 'Provocador decisivo'],
];

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const LEGENDS: Legend[] = [
  ...OUTFIELD.map(([name, country, position, era, [pac, sho, pas, dri, def, phy], style]) => ({
    id: slug(name),
    name,
    country,
    position,
    era,
    stats: { pac, sho, pas, dri, def, phy },
    style,
  })),
  ...KEEPERS.map(([name, country, era, [div, han, ref, gkp, kic, phy], style]) => ({
    id: slug(name),
    name,
    country,
    position: 'GOL' as PositionId,
    era,
    stats: { div, han, ref, gkp, kic, phy },
    style,
  })),
];

export const LEGEND_BY_ID: Record<string, Legend> = Object.fromEntries(LEGENDS.map((l) => [l.id, l]));

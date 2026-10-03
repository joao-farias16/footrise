import { POSITIONS } from '../config/positions';
import type { AttrKey, Attributes, PositionId } from '../types';

function topOf(attrs: Attributes, keys: AttrKey[]): AttrKey {
  return keys.reduce((best, k) => ((attrs[k] ?? 0) > (attrs[best] ?? 0) ? k : best), keys[0]);
}

/** Estilo de jogo derivado da combinação de atributos e da posição. */
export function deriveStyle(attrs: Attributes, position: PositionId): string {
  const v = (k: AttrKey) => attrs[k] ?? 0;
  const group = POSITIONS[position].group;

  if (group === 'gk') {
    if (['div', 'han', 'ref', 'gkp'].every((k) => v(k as AttrKey) >= 86)) return 'Goleiro completo';
    if (v('kic') >= 86) return 'Goleiro-líbero';
    const top = topOf(attrs, ['div', 'han', 'ref', 'gkp']);
    if (top === 'ref' || top === 'div') return 'Goleiro de reflexo';
    return 'Goleiro seguro';
  }

  if (group === 'att') {
    if (['pac', 'sho', 'dri', 'pas'].every((k) => v(k as AttrKey) >= 86)) return 'Atacante completo';
    const top = topOf(attrs, ['pac', 'sho', 'dri', 'pas', 'phy']);
    if (position === 'ATA') {
      if (top === 'sho') return v('phy') >= 86 ? 'Centroavante tanque' : 'Finalizador';
      if (top === 'pac') return 'Atacante explosivo';
      if (top === 'dri') return 'Driblador';
      if (top === 'pas') return 'Falso 9';
      return 'Pivô';
    }
    if (top === 'pac') return 'Ponta explosivo';
    if (top === 'dri') return 'Driblador';
    if (top === 'sho') return 'Ponta artilheiro';
    if (top === 'pas') return 'Ponta construtor';
    return 'Ponta de força';
  }

  if (group === 'mid') {
    if (position === 'VOL') {
      if (v('def') >= 82 && v('pas') >= 82 && v('phy') >= 82) return 'Volante completo';
      const top = topOf(attrs, ['def', 'pas', 'phy', 'dri']);
      if (top === 'pas' || top === 'dri') return 'Volante construtor';
      if (top === 'def') return 'Cão de guarda';
      return 'Motor do meio';
    }
    if (v('def') >= 78 && v('phy') >= 80 && v('pas') >= 80) return 'Box-to-box';
    const top = topOf(attrs, ['pas', 'dri', 'sho', 'pac']);
    if (top === 'pas') return v('dri') >= 85 ? 'Meia cerebral' : 'Criador';
    if (top === 'dri') return 'Meia driblador';
    if (top === 'sho') return 'Meia finalizador';
    return 'Meia de transição';
  }

  // Defensores
  if (position === 'ZAG') {
    if (v('def') >= 90 && v('phy') >= 88) return 'Muralha';
    if (v('pas') >= 84) return 'Zagueiro construtor';
    if (v('pac') >= 85) return 'Zagueiro rápido';
    return v('phy') > v('def') ? 'Zagueiro imponente' : 'Defensor';
  }
  if (v('pac') >= 88 && v('pas') >= 84) return 'Ala ofensivo';
  const top = topOf(attrs, ['def', 'pac', 'pas', 'phy']);
  if (top === 'def') return 'Lateral defensivo';
  if (top === 'pas') return 'Lateral armador';
  if (top === 'pac') return 'Lateral veloz';
  return 'Lateral de força';
}

import { ATTR_META, attrKeysFor } from '../config/positions';
import type { AttrKey, Attributes, PositionId } from '../types';
import { Flag } from './common';

export function cardTierClass(ovr: number): string {
  if (ovr >= 88) return 'tier-elite-card';
  if (ovr >= 80) return 'tier-gold-card';
  if (ovr >= 70) return 'tier-silver-card';
  return 'tier-bronze-card';
}

export interface PlayerCardProps {
  name: string;
  nationality: string;
  position: PositionId;
  number: number;
  ovr: number;
  ovrLabel?: string;
  attributes: Attributes;
  style: string;
  reveal?: boolean;
}

export function PlayerCard({ name, nationality, position, number, ovr, ovrLabel = 'OVR', attributes, style, reveal }: PlayerCardProps) {
  const keys: AttrKey[] = attrKeysFor(position);
  return (
    <div className={`fr-card-wrap ${reveal ? 'card-reveal' : ''}`}>
      <div className={`fr-card ${cardTierClass(ovr)}`} aria-label={`Carta de ${name}: ${ovr} ${ovrLabel}`}>
        <div className="fr-card-top">
          <div>
            <div className="fr-card-ovr">{ovr}</div>
            <div className="fr-card-label">{ovrLabel}</div>
            <div className="fr-card-pos">{position}</div>
            <div className="fr-card-flag">
              <Flag code={nationality} />
            </div>
          </div>
          <div className="fr-card-brand">FOOTRISE</div>
        </div>
        <div className="fr-card-number" aria-hidden="true">
          {number}
        </div>
        <div className="fr-card-body">
          <div className="fr-card-name">{name}</div>
          <div className="fr-card-style">{style}</div>
          <div className="fr-card-attrs">
            {keys.map((k) => (
              <div className="fr-card-attr" key={k}>
                <b>{attributes[k] ?? '—'}</b>
                <span>{ATTR_META[k].short}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

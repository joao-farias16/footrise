import type { ReactNode } from 'react';
import { getClub, getLeague } from '../data/clubs';
import { clubExposure, formatMoney, titleChance } from '../engine/market';
import type { Offer } from '../types';
import { Bar, Crest, Flag, meterColor, Pill } from './common';

export function ClubFacts({ clubId, startShare, weeklyWage, fee }: { clubId: string; startShare: number; weeklyWage?: number; fee?: number }) {
  const club = getClub(clubId);
  if (!club) return null;
  const share = Math.round(startShare * 100);
  return (
    <>
      <div className="kv-grid">
        <div className="kv">
          <div className="k">Força</div>
          <div className="v">{club.strength}</div>
        </div>
        <div className="kv">
          <div className="k">Titularidade</div>
          <div className="v">{share}%</div>
          <Bar value={share} color={meterColor(share)} />
        </div>
        {weeklyWage !== undefined && (
          <div className="kv">
            <div className="k">Salário</div>
            <div className="v">{formatMoney(weeklyWage)}/sem</div>
          </div>
        )}
        {fee !== undefined && fee > 0 && (
          <div className="kv">
            <div className="k">Transferência</div>
            <div className="v">{formatMoney(fee)}</div>
          </div>
        )}
        <div className="kv">
          <div className="k">Exposição</div>
          <div className="v">{clubExposure(club)}</div>
        </div>
        <div className="kv">
          <div className="k">Chance de títulos</div>
          <div className="v">{titleChance(club)}</div>
        </div>
      </div>
    </>
  );
}

export function ClubHeader({ clubId }: { clubId: string }) {
  const club = getClub(clubId);
  if (!club) return null;
  const league = getLeague(club.leagueId);
  return (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      <Crest clubId={club.id} size="lg" />
      <div style={{ minWidth: 0 }}>
        <div className="club-name">{club.name}</div>
        <div className="row faint" style={{ gap: 6, marginTop: 4 }}>
          <Flag code={league.country} /> {league.name}
        </div>
      </div>
    </div>
  );
}

export function OfferCard({ offer, action, delay = 0 }: { offer: Offer; action: ReactNode; delay?: number }) {
  const club = getClub(offer.clubId);
  if (!club) return null;
  return (
    <article
      className={`club-card ${offer.big ? 'big' : ''}`}
      style={{ ['--club-a' as string]: club.colors[0], ['--club-b' as string]: club.colors[1], animationDelay: `${delay}s` }}
    >
      <div className="row" style={{ gap: 6 }}>
        {offer.big && <Pill tone="gold">🔥 Grande proposta</Pill>}
        {offer.kind === 'loan' && <Pill tone="blue">↔ Empréstimo · 1 temporada</Pill>}
        {offer.kind === 'transfer' && !offer.big && <Pill>Transferência</Pill>}
      </div>
      <ClubHeader clubId={club.id} />
      <p className="muted">{offer.pitch}</p>
      <ClubFacts clubId={club.id} startShare={offer.startShare} weeklyWage={offer.weeklyWage} fee={offer.fee} />
      <div style={{ marginTop: 'auto' }}>{action}</div>
    </article>
  );
}

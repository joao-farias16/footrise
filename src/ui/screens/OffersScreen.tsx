import { getClub } from '../../data/clubs';
import { acceptOffer, currentOverall, stayAtClub } from '../../engine/career';
import { expectedStartShare, formatMoney } from '../../engine/market';
import { seasonLabel } from '../../engine/season';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { TopBar } from '../common';
import { ClubFacts, ClubHeader, OfferCard } from '../OfferCard';

export function OffersScreen({ career }: { career: Career }) {
  const { act } = useGame();
  const club = getClub(career.clubId);
  const ovr = currentOverall(career);
  const last = career.seasons[career.seasons.length - 1];
  const returnedFromLoan = last?.loan && last.clubId !== career.clubId;
  const hasBig = career.offers.some((o) => o.big);

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="stack">
          <div>
            <div className="eyebrow">Janela de transferências · {seasonLabel(career.year)}</div>
            <h1>{hasBig ? 'Gigantes batendo à porta' : 'O mercado se mexeu'}</h1>
            <p className="muted">
              {career.offers.length} proposta{career.offers.length > 1 ? 's' : ''} na mesa. {ovr} OVR · {career.age} anos.
            </p>
          </div>
          {returnedFromLoan && (
            <div className="banner banner-green">
              <span className="banner-icon" aria-hidden="true">
                ↩
              </span>
              <span>Fim do empréstimo: você voltou ao {club?.name}.</span>
            </div>
          )}
          <div className="grid-3">
            {club && (
              <article
                className="club-card stay"
                style={{ ['--club-a' as string]: club.colors[0], ['--club-b' as string]: club.colors[1] }}
              >
                <div className="row">
                  <span className="pill">🏠 Seu clube atual</span>
                </div>
                <ClubHeader clubId={club.id} />
                <p className="muted">Continuidade: você conhece o elenco e a relação com o treinador é mantida.</p>
                <ClubFacts clubId={club.id} startShare={expectedStartShare(ovr, club.strength, career.coachTrust, career.position)} weeklyWage={career.weeklyWage} />
                <button className="btn btn-block" style={{ marginTop: 'auto' }} onClick={() => act(stayAtClub)}>
                  Permanecer
                </button>
              </article>
            )}
            {career.offers.map((o, i) => (
              <OfferCard
                key={o.id}
                offer={o}
                delay={(i + 1) * 0.08}
                action={
                  <button className={`btn btn-block ${o.big ? 'btn-gold' : 'btn-primary'}`} onClick={() => act((c) => acceptOffer(c, o.id))}>
                    {o.kind === 'loan' ? 'Aceitar empréstimo' : `Aceitar${o.fee > 0 ? ` · ${formatMoney(o.fee)}` : ''}`}
                  </button>
                }
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

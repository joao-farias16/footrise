import { getClub } from '../../data/clubs';
import { acceptOffer, currentOverall, stayAtClub } from '../../engine/career';
import { expectedStartShare, formatMoney } from '../../engine/market';
import { seasonLabel } from '../../engine/season';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { Banner, clubColorVars, OvrBadge, PageHead, Pill, TopBar } from '../common';
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
          <PageHead
            eyebrow={`Janela de transferências · ${seasonLabel(career.year)}`}
            title={hasBig ? 'Gigantes batendo à porta' : 'O mercado se mexeu'}
            sub={`${career.offers.length} proposta${career.offers.length > 1 ? 's' : ''} na mesa · ${career.age} anos.`}
            aside={<OvrBadge value={ovr} label="OVR atual" />}
          />
          {returnedFromLoan && (
            <Banner tone="green" icon="↩">
              Fim do empréstimo: você voltou ao {club?.name}.
            </Banner>
          )}
          <div className="grid-auto">
            {club && (
              <article className="club-card stay" style={clubColorVars(club.id)}>
                <div className="club-card-tags">
                  <Pill>🏠 Seu clube atual</Pill>
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

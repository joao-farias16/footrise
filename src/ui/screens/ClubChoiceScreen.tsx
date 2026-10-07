import { chooseInitialClub, currentOverall } from '../../engine/career';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { OvrBadge, PageHead, TopBar } from '../common';
import { OfferCard } from '../OfferCard';

export function ClubChoiceScreen({ career }: { career: Career }) {
  const { act } = useGame();
  return (
    <>
      <TopBar />
      <main className="page">
        <div className="stack">
          <PageHead
            eyebrow="Primeiro contrato"
            title="Onde começa a sua história?"
            sub={`${career.offers.length} clubes querem você. Escolha com calma: o primeiro contrato define seus minutos em campo.`}
            aside={<OvrBadge value={currentOverall(career)} label="OVR atual" />}
          />
          <div className="tip">
            <span aria-hidden="true">💡</span>
            <span>
              Clube forte nem sempre é a melhor escolha. <strong>Minutos em campo aceleram sua evolução</strong>; ligas fortes dão mais
              exposição; salário não ganha jogo.
            </span>
          </div>
          <div className="grid-auto">
            {career.offers.map((o, i) => (
              <OfferCard
                key={o.id}
                offer={o}
                delay={i * 0.08}
                action={
                  <button className="btn btn-primary btn-block" onClick={() => act((c) => chooseInitialClub(c, o.id))}>
                    Assinar contrato
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

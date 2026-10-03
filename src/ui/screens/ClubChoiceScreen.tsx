import { chooseInitialClub, currentOverall } from '../../engine/career';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { TopBar } from '../common';
import { OfferCard } from '../OfferCard';

export function ClubChoiceScreen({ career }: { career: Career }) {
  const { act } = useGame();
  return (
    <>
      <TopBar />
      <main className="page">
        <div className="stack">
          <div>
            <div className="eyebrow">Primeiro contrato · {currentOverall(career)} OVR</div>
            <h1>Onde começa a sua história?</h1>
          </div>
          <div className="tip">
            <span aria-hidden="true">💡</span>
            <span>
              Clube forte nem sempre é a melhor escolha. <strong>Minutos em campo aceleram sua evolução</strong>; ligas fortes dão mais
              exposição; salário não ganha jogo.
            </span>
          </div>
          <div className="grid-3">
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

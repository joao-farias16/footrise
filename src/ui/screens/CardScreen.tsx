import { ATTR_META, POSITIONS, attrKeysFor } from '../../config/positions';
import { LEGEND_BY_ID } from '../../data/legends';
import { currentOverall, goToClubChoice, potentialOverall } from '../../engine/career';
import { legendName } from '../../engine/draft';
import { deriveStyle } from '../../engine/style';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { Banner, LegendAvatar, ovrClass, OvrBadge, Pill, TopBar } from '../common';
import { PlayerCard } from '../PlayerCard';

export function CardScreen({ career }: { career: Career }) {
  const { act } = useGame();
  const pot = potentialOverall(career);
  const ovr = currentOverall(career);
  const style = deriveStyle(career.potential, career.position);
  const keys = attrKeysFor(career.position);

  return (
    <>
      <TopBar />
      <main className="page page-mid">
        <div className="reveal-layout">
          <div className="stack" style={{ alignItems: 'center' }}>
            <div className="eyebrow">Seu jogador nasceu</div>
            <div className="card-stage">
              <PlayerCard
                name={career.profile.name}
                nationality={career.profile.nationality}
                position={career.position}
                number={career.profile.number}
                ovr={pot}
                ovrLabel="Potencial"
                attributes={career.potential}
                style={style}
                reveal
              />
            </div>
          </div>

          <div className="stack reveal">
            <div className="stack stack-xs">
              <h2>O DNA de {career.profile.name.split(' ')[0]}</h2>
              <p className="muted">Cada atributo veio de alguém. Este é o teto que o seu talento pode alcançar.</p>
            </div>
            <div className="row">
              <OvrBadge value={ovr} label={`Hoje · ${career.age} anos`} />
              <OvrBadge value={pot} label="Potencial" outline />
            </div>
            <div className="dna-list">
              {keys.map((k, i) => {
                const src = career.sources[k] ?? 'academy';
                return (
                  <div className="dna-item" key={k} style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
                    <span className="attr-key">{ATTR_META[k].short}</span>
                    <span className={`attr-val ${ovrClass(career.potential[k] ?? 0)}`} style={{ textAlign: 'left' }}>
                      {career.potential[k]}
                    </span>
                    <span className="row nowrap" style={{ gap: 8, minWidth: 0 }}>
                      {LEGEND_BY_ID[src] ? <LegendAvatar legendId={src} size={30} /> : <span aria-hidden="true">🏫</span>}
                      <span className="ellipsis">{legendName(src)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="row">
              <Pill tone="gold">⭐ {style}</Pill>
              <Pill>{POSITIONS[career.position].label}</Pill>
              <Pill>Pé {career.profile.foot === 'D' ? 'direito' : 'esquerdo'}</Pill>
            </div>
            <Banner tone="green" icon="🌱">
              <strong>Hoje, aos {career.age} anos: {ovr} OVR.</strong>
              <div className="muted">Potencial {pot}. Minutos em campo, bom desempenho e boas decisões aproximam você desse teto.</div>
            </Banner>
            <button className="btn btn-primary btn-xl btn-block" onClick={() => act(goToClubChoice)}>
              Escolher primeiro clube →
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

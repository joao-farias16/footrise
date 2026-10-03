import { ATTR_META, POSITIONS, attrKeysFor } from '../../config/positions';
import { continueAfterReview } from '../../engine/career';
import { formatMoney } from '../../engine/market';
import { useGame } from '../../state/GameContext';
import { getCountry } from '../../data/countries';
import type { Career, SeasonRecord } from '../../types';
import { Crest, Flag, ovrClass, Pill, ratingClass, ratingLabel, StatTile, TopBar } from '../common';
import { trophyIcon } from '../CareerWidgets';

/** Estatísticas que importam para a posição (chutes para atacantes, desarmes para defensores...). */
function DetailTiles({ s }: { s: SeasonRecord }) {
  const d = s.detail;
  if (!d || s.apps === 0) return null;
  const group = POSITIONS[s.position].group;
  const per90 = (v: number) => (s.minutes > 0 ? ((v * 90) / s.minutes).toFixed(1) : '0');
  if (group === 'gk') {
    const faced = d.saves + d.conceded;
    return (
      <>
        <StatTile label="Defesas" value={d.saves} sub={faced > 0 ? `${Math.round((d.saves / faced) * 100)}% de aproveitamento` : undefined} />
        <StatTile label="Gols sofridos" value={d.conceded} sub={`${per90(d.conceded)} por jogo`} />
      </>
    );
  }
  const tiles = {
    shots: <StatTile key="sh" label="Finalizações" value={d.shots} sub={d.shots > 0 ? `${Math.round((s.goals / d.shots) * 100)}% viram gol` : undefined} />,
    keyPasses: <StatTile key="kp" label="Passes decisivos" value={d.keyPasses} sub={`${per90(d.keyPasses)} por 90 min`} />,
    tackles: <StatTile key="tk" label="Desarmes" value={d.tackles} sub={`${per90(d.tackles)} por 90 min`} />,
    interceptions: <StatTile key="in" label="Interceptações" value={d.interceptions} sub={`${per90(d.interceptions)} por 90 min`} />,
    clearances: <StatTile key="cl" label="Cortes" value={d.clearances} sub="bolas aéreas e afastadas" />,
  };
  if (group === 'att') return <>{[tiles.shots, tiles.keyPasses]}</>;
  if (s.position === 'MEI') return <>{[tiles.keyPasses, tiles.shots, tiles.tackles]}</>;
  if (s.position === 'VOL') return <>{[tiles.tackles, tiles.interceptions, tiles.keyPasses]}</>;
  if (s.position === 'ZAG') return <>{[tiles.tackles, tiles.interceptions, tiles.clearances]}</>;
  return <>{[tiles.tackles, tiles.interceptions, tiles.keyPasses]}</>;
}

/** Temporada da seleção: convocações, números e campanhas (eliminatórias, Liga das Nações, torneios). */
function NationalSeasonPanel({ s, nationality }: { s: SeasonRecord; nationality: string }) {
  const n = s.national;
  const comps = n.competitions ?? [];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 6 }}>
        <Flag code={nationality} />
        <strong>{getCountry(nationality).name}</strong>
        {n.calledUp ? <Pill tone="blue">🌍 Convocado</Pill> : <Pill>Fora da lista</Pill>}
      </div>
      {n.calledUp ? (
        <span>
          {n.callups !== undefined && n.windows !== undefined && `${n.callups} convocação${n.callups === 1 ? '' : 'ões'} · `}
          {n.caps} jogos{n.starts !== undefined && ` (${n.starts} como titular)`} · {n.goals} gols
          {n.assists !== undefined && ` · ${n.assists} assist.`}
          {n.rating ? ` · nota ${n.rating.toFixed(2)}` : ''}
        </span>
      ) : (
        <p className="faint">
          {(n.missedInjured ?? 0) > 0 ? 'Lesões tiraram você das convocações nesta temporada.' : 'Não foi convocado nesta temporada.'}
        </p>
      )}
      {comps.length > 0 ? (
        <div className="comp-list">
          {comps.map((c, i) => (
            <div className={`comp ${c.won ? 'won' : ''}`} key={i}>
              <span>
                {c.won && <span aria-hidden="true">🏆 </span>}
                {c.name}
                <span className="faint">
                  {' '}
                  · {c.inSquad ? (c.caps > 0 ? `${c.caps}J ${c.goals}G ${c.assists}A` : 'no elenco') : 'fora do elenco'}
                </span>
              </span>
              <strong>{c.result}</strong>
            </div>
          ))}
        </div>
      ) : (
        n.tournament && (
          <div className={`comp ${n.tournament.won ? 'won' : ''}`}>
            <span>{n.tournament.name}</span>
            <strong>{n.tournament.result}</strong>
          </div>
        )
      )}
    </div>
  );
}

export function SeasonReviewScreen({ career }: { career: Career }) {
  const { act } = useGame();
  const s = career.seasons[career.seasons.length - 1];
  if (!s) return null;
  const pos = POSITIONS[s.position];
  const defensive = pos.group === 'gk' || pos.group === 'def';
  const diff = s.ovrEnd - s.ovrStart;
  const ending = career.retireAnnounced || !!career.forcedRetirementReason;
  const injuredGames = s.injuries.reduce((t, i) => t + i.games, 0);
  const big = s.trophies.length > 0 || s.awards.some((a) => a.kind === 'world');

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="stack reveal">
          <div className="review-hero">
            <Crest clubId={s.clubId} size="lg" />
            <div className="eyebrow">Temporada {s.season} encerrada</div>
            <h1>{big ? (s.trophies.length > 0 ? 'Temporada de campeão!' : 'Temporada histórica!') : s.rating >= 7.2 ? 'Que temporada!' : s.rating >= 6.7 ? 'Temporada sólida' : s.apps === 0 ? 'Um ano perdido' : 'Temporada difícil'}</h1>
            <p className="muted">
              {s.clubName} · {s.age} anos · {pos.label}
            </p>
          </div>

          {s.trophies.length > 0 && (
            <div className="banner banner-gold" role="status">
              <span className="banner-icon" aria-hidden="true">
                🏆
              </span>
              <div className="row" style={{ gap: 6 }}>
                <strong>Campeão!</strong>
                {s.trophies.map((t, i) => (
                  <Pill tone="gold" key={i}>
                    {trophyIcon(t.kind)} {t.name}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div className="stat-tiles">
            <StatTile label="Jogos" value={s.apps} sub={`${s.starts} como titular`} />
            <StatTile label="Minutos" value={s.minutes.toLocaleString('pt-BR')} />
            {defensive ? (
              <StatTile label="Sem sofrer gols" value={s.cleanSheets} sub={pos.group === 'gk' ? 'clean sheets' : `${s.goals} gols`} />
            ) : (
              <StatTile label="Gols" value={s.goals} sub={`${s.leagueGoals} na liga`} />
            )}
            <StatTile label="Assistências" value={s.assists} />
            <DetailTiles s={s} />
            <StatTile label="Nota média" value={<span className={ratingClass(s.rating)}>{s.rating > 0 ? s.rating.toFixed(2) : '—'}</span>} sub={ratingLabel(s.rating)} />
            <StatTile label="Cartões" value={`${s.yellow}🟨 ${s.red}🟥`} sub={`${s.yellow} amarelos, ${s.red} vermelhos`} />
            <StatTile label="Lesões" value={s.injuries.length} sub={injuredGames > 0 ? `${injuredGames} jogos fora` : 'Ileso'} />
            <StatTile label="Valor de mercado" value={formatMoney(s.marketValue)} />
          </div>

          <div className="grid-2">
            <div className="panel panel-tight stack" style={{ gap: 10 }}>
              <h3>Competições</h3>
              <div className="comp-list">
                {s.competitions.map((c, i) => (
                  <div className={`comp ${c.won ? 'won' : ''}`} key={i}>
                    <span>
                      {c.won && <span aria-hidden="true">🏆 </span>}
                      {c.name}
                    </span>
                    <strong>{c.result}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <h3>Seleção</h3>
              <NationalSeasonPanel s={s} nationality={career.profile.nationality} />
            </div>

            <div className="panel panel-tight stack" style={{ gap: 10 }}>
              <h3>Evolução</h3>
              <div className="ovr-change" aria-label={`Overall de ${s.ovrStart} para ${s.ovrEnd}`}>
                <span className="from">{s.ovrStart}</span>
                <span aria-hidden="true">→</span>
                <span className={`to ${ovrClass(s.ovrEnd)}`}>{s.ovrEnd}</span>
                <Pill tone={diff > 0 ? 'green' : diff < 0 ? 'red' : 'neutral'}>{diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : '= estável'}</Pill>
              </div>
              <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                {attrKeysFor(s.position).map((k) => {
                  const d = s.attrDelta[k] ?? 0;
                  return (
                    <Pill key={k} tone={d > 0 ? 'green' : d < 0 ? 'red' : 'neutral'}>
                      {ATTR_META[k].short} {d > 0 ? `+${d}` : d}
                    </Pill>
                  );
                })}
              </div>
              {s.awards.length > 0 && (
                <>
                  <div className="divider" />
                  <h3>Prêmios</h3>
                  <div className="row" style={{ gap: 6 }}>
                    {s.awards.map((a, i) => (
                      <Pill tone="purple" key={i}>
                        🥇 {a.name}
                      </Pill>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {(s.headlines.length > 0 || s.eventNotes.length > 0) && (
            <div className="panel panel-tight stack" style={{ gap: 8 }}>
              <h3>Manchetes</h3>
              {s.headlines.map((h, i) => (
                <div className="headline" key={`h${i}`}>
                  {h}
                </div>
              ))}
              {s.eventNotes.map((n, i) => (
                <div className="headline" key={`e${i}`} style={{ borderLeftColor: 'var(--blue)' }}>
                  📝 {n}
                </div>
              ))}
              {s.injuries
                .filter((i) => i.games < 12)
                .slice(0, 3)
                .map((inj, i) => (
                  <div className="headline" key={`i${i}`} style={{ borderLeftColor: 'var(--red)' }}>
                    🩹 {inj.label}: {inj.games} jogo{inj.games > 1 ? 's' : ''} fora
                  </div>
                ))}
            </div>
          )}

          {ending && (
            <div className="banner banner-gold">
              <span className="banner-icon" aria-hidden="true">
                👋
              </span>
              <span>{career.forcedRetirementReason ?? 'Esta foi a sua última temporada. Hora de olhar para trás.'}</span>
            </div>
          )}

          <div className="action-bar">
            <button className={`btn btn-xl ${ending ? 'btn-gold' : 'btn-primary'}`} onClick={() => act(continueAfterReview)}>
              {ending ? 'Encerrar carreira →' : 'Continuar →'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

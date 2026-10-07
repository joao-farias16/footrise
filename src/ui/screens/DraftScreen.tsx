import { useEffect, useRef, useState } from 'react';
import { ATTR_META, attrKeysFor } from '../../config/positions';
import { LEGEND_BY_ID } from '../../data/legends';
import { draftPick, draftReroll } from '../../engine/career';
import { legendName, legendValue, optionGain, projectedOverall } from '../../engine/draft';
import { weightTier } from '../../engine/overall';
import { useGame } from '../../state/GameContext';
import type { AttrKey, Career, DraftOption } from '../../types';
import { Flag, LegendAvatar, OvrBadge, PageHead, Pill, TopBar } from '../common';

const PICK_DELAY_MS = 480;

function gainText(gain: number): string {
  const g = Math.round(gain * 10) / 10;
  if (g > 0) return `POT +${g.toFixed(1)}`;
  if (g < 0) return `POT ${g.toFixed(1)}`;
  return 'POT ±0';
}

export function DraftScreen({ career }: { career: Career }) {
  const { act, settings } = useGame();
  const { draft, profile, mode } = career;
  const position = profile.position;
  const instinct = mode === 'instinct';
  const round = draft.current;
  const [picking, setPicking] = useState<number | null>(null);
  const [flashAttr, setFlashAttr] = useState<AttrKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!round) return null;

  const keys = attrKeysFor(position);
  const projected = projectedOverall(draft.slots, position);
  const empty = keys.filter((k) => !draft.slots[k]);
  const roundsLeft = draft.totalRounds - draft.round;

  const pick = (index: number, option: DraftOption) => {
    if (picking !== null) return;
    setPicking(index);
    const msg = `${ATTR_META[option.attr].label}${instinct ? '' : ` ${option.value}`} de ${legendName(option.legendId)}`;
    const commit = () => {
      act((c) => draftPick(c, index));
      setPicking(null);
      setFlashAttr(option.attr);
      setToast(`✔ Você pegou ${msg}`);
    };
    if (settings.reduceMotion) commit();
    else timer.current = window.setTimeout(commit, PICK_DELAY_MS);
  };

  const rerollUsed = !!draft.rerollUsed;
  const reroll = () => {
    if (picking !== null || rerollUsed) return;
    act(draftReroll);
    setToast('🔄 Novas lendas sorteadas para esta rodada');
  };

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="stack">
          <PageHead
            eyebrow="Draft de lendas"
            title={
              <>
                Rodada {draft.round}
                <span className="muted" style={{ fontSize: '0.6em' }}>
                  {' '}
                  / {draft.totalRounds}
                </span>
              </>
            }
            aside={
              <div className="draft-head-side">
                <Pill tone={instinct ? 'purple' : 'blue'}>{instinct ? '🧠 Modo instinto' : '📊 Modo analista'}</Pill>
                <div className="round-track" aria-label={`Rodada ${draft.round} de ${draft.totalRounds}`}>
                  {Array.from({ length: draft.totalRounds }, (_, i) => (
                    <span key={i} className={i + 1 < draft.round ? 'done' : i + 1 === draft.round ? 'now' : ''} />
                  ))}
                </div>
              </div>
            }
          />

          <div className="draft-layout">
            <aside className="panel draft-build" aria-label="Seu jogador">
              <div className="panel-title">
                <h3>
                  {profile.name} <span className="muted">· {position}</span>
                </h3>
                {!instinct && <OvrBadge value={Math.round(projected)} label="Potencial" size="sm" />}
              </div>
              <div className="slot-list">
                {keys.map((k) => {
                  const slot = draft.slots[k];
                  return (
                    <div key={`${k}-${flashAttr === k ? draft.round : 0}`} className={`slot ${slot ? 'filled' : ''} ${flashAttr === k ? 'flash' : ''}`}>
                      <div>
                        <div className="attr-key">{ATTR_META[k].short}</div>
                        <div className="weight-tag">peso {weightTier(position, k)}</div>
                      </div>
                      <div className="src">{slot ? `🔒 ${legendName(slot.source)}` : 'Vazio'}</div>
                      <div className="attr-val">{slot ? (instinct ? '★' : slot.value) : <span className="faint">?</span>}</div>
                    </div>
                  );
                })}
              </div>
              <p className="faint" style={{ marginTop: 12 }}>
                {roundsLeft > 0 ? `${roundsLeft} rodada${roundsLeft > 1 ? 's' : ''} depois desta. ` : 'Última rodada! '}
                {`${empty.length} atributo${empty.length > 1 ? 's' : ''} vazio${empty.length > 1 ? 's' : ''}. Atributo escolhido fica bloqueado.`}
              </p>
            </aside>

            <section aria-label="Lendas desta rodada" className="stack">
              <div className="draft-actions">
                <p className="muted">
                  Escolha <strong>um atributo vazio</strong> de uma das lendas. Cada atributo só pode ser escolhido uma vez.
                </p>
                <button
                  className="btn btn-sm btn-ghost reroll-btn"
                  onClick={reroll}
                  disabled={rerollUsed || picking !== null}
                  title={rerollUsed ? 'Você já usou o Reroll nesta carreira.' : 'Sorteia novas lendas para esta rodada. Você pode usar o Reroll uma vez por carreira.'}
                  aria-label={rerollUsed ? 'Reroll já usado nesta carreira' : 'Reroll: sortear novas lendas para esta rodada (uma vez por carreira)'}
                >
                  🔄 {rerollUsed ? 'Reroll usado' : 'Reroll'}
                  {!rerollUsed && <span className="reroll-hint">1× por carreira</span>}
                </button>
              </div>
              <div className="legend-grid" key={`${draft.round}-${rerollUsed ? 'r' : ''}`}>
                {round.options.map((option, i) => {
                  const legend = LEGEND_BY_ID[option.legendId];
                  if (!legend) return null;
                  const gain = optionGain(draft.slots, position, option);
                  const current = draft.slots[option.attr];
                  const shownKeys = attrKeysFor(position).filter((k) => legendValue(legend, k) !== undefined);
                  const cls = picking === null ? '' : picking === i ? 'is-picked' : 'is-dimmed';
                  return (
                    <article className={`legend-card ${cls}`} key={`${option.legendId}-${option.attr}`}>
                      <div className="legend-head">
                        <LegendAvatar legendId={legend.id} />
                        <div style={{ minWidth: 0 }}>
                          <div className="legend-name">{legend.name}</div>
                          <div className="row row-tight faint" style={{ marginTop: 4 }}>
                            <Flag code={legend.country} /> {legend.position} · {legend.era}
                          </div>
                          <div className="faint" style={{ fontStyle: 'italic' }}>
                            {legend.style}
                          </div>
                        </div>
                      </div>
                      <div className="legend-stats">
                        {shownKeys.map((k) => (
                          <div key={k} className={`legend-stat ${k === option.attr ? 'offered' : ''}`}>
                            <span className="k">{ATTR_META[k].short}</span>
                            <span className="v">{instinct ? '?' : legendValue(legend, k)}</span>
                          </div>
                        ))}
                      </div>
                      {!instinct && (
                        <div className="row row-tight">
                          <Pill tone={gain >= 2 ? 'green' : gain > 0 ? 'blue' : 'red'}>{gainText(gain)}</Pill>
                          {current ? (
                            <Pill tone={option.value > current.value ? 'neutral' : 'red'}>
                              Substitui {current.value} ({legendName(current.source)})
                            </Pill>
                          ) : (
                            <Pill tone="green">Preenche vazio</Pill>
                          )}
                        </div>
                      )}
                      {instinct && current && <Pill>Substitui {legendName(current.source)}</Pill>}
                      <button
                        className="pick-btn"
                        onClick={() => pick(i, option)}
                        disabled={picking !== null || !!current}
                        aria-label={`Pegar ${ATTR_META[option.attr].label} de ${legend.name}`}
                      >
                        <span className="main">
                          Pegar {ATTR_META[option.attr].label}
                          {!instinct && ` ${option.value}`}
                        </span>
                        <span className="sub">de {legend.name}</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
      {toast && (
        <div className="toast toast-pick" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

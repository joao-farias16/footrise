import { chooseEventOption, continueAfterEvent } from '../../engine/career';
import { viewEvent } from '../../engine/events';
import { seasonLabel } from '../../engine/season';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { Pill, TopBar, type PillTone } from '../common';

const TAG_LABEL: Record<string, { text: string; tone: PillTone }> = {
  potential: { text: '📈 Potencial aumentou', tone: 'green' },
  'attr-up': { text: '⬆ Atributo melhorou', tone: 'green' },
  'attr-down': { text: '⬇ Atributo caiu', tone: 'red' },
  position: { text: '🔄 Nova posição', tone: 'gold' },
  interest: { text: '🔭 Proposta garantida', tone: 'gold' },
  wage: { text: '💰 Salário reajustado', tone: 'green' },
  injury: { text: '🩹 Lesão', tone: 'red' },
};

const CHOICE_KEYS = ['A', 'B', 'C', 'D', 'E'];

export function EventScreen({ career }: { career: Career }) {
  const { act } = useGame();
  const instance = career.events[career.eventIndex];
  if (!instance) return null;
  const view = viewEvent(career, instance);
  if (!view) {
    // Evento desconhecido (ex.: save antigo): segue em frente.
    return (
      <main className="page page-narrow">
        <button className="btn btn-primary btn-block" onClick={() => act((c) => continueAfterEvent(chooseEventOption(c, 0)))}>
          Continuar
        </button>
      </main>
    );
  }
  const resolved = instance.resolved;
  const isLast = career.eventIndex >= career.events.length - 1;

  return (
    <>
      <TopBar />
      <main className="page page-narrow">
        <div className="event-card" key={`${career.eventIndex}`}>
          <div className="stack stack-sm">
            <div className="row between">
              <div className="eyebrow">
                Pré-temporada {seasonLabel(career.year)} · evento {career.eventIndex + 1} de {career.events.length}
              </div>
              <Pill>{view.category}</Pill>
            </div>
            <div className="event-progress" aria-hidden="true">
              {career.events.map((_, i) => (
                <span key={i} className={i < career.eventIndex ? 'done' : i === career.eventIndex ? 'now' : ''} />
              ))}
            </div>
          </div>

          <div className="panel event-story">
            <div className="event-icon" aria-hidden="true">
              {view.icon}
            </div>
            <div className="stack stack-sm" style={{ minWidth: 0 }}>
              <h2>{view.title}</h2>
              <p className="muted" style={{ fontSize: '1.05rem' }}>
                {view.text}
              </p>
            </div>
          </div>

          {!resolved && (
            <div className="choice-list" role="group" aria-label="Escolhas">
              {view.choices.map((ch, i) => (
                <button key={i} className="choice-btn" onClick={() => act((c) => chooseEventOption(c, i))}>
                  <span className="choice-key" aria-hidden="true">
                    {CHOICE_KEYS[i] ?? i + 1}
                  </span>
                  <strong>{ch.label}</strong>
                  <span className="choice-hint">{ch.hint}</span>
                </button>
              ))}
            </div>
          )}

          {resolved && (
            <>
              <div className="outcome" role="status">
                <div className="faint" style={{ marginBottom: 6 }}>
                  Você escolheu: <strong>{view.choices[resolved.choiceIndex]?.label}</strong>
                </div>
                <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>{resolved.text}</p>
                {resolved.tags.length > 0 && (
                  <div className="row row-tight" style={{ marginTop: 12 }}>
                    {[...new Set(resolved.tags)].map((t) => (
                      <Pill key={t} tone={TAG_LABEL[t]?.tone ?? 'neutral'}>
                        {TAG_LABEL[t]?.text ?? t}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
              <div className="action-bar">
                <button className="btn btn-primary btn-xl" onClick={() => act(continueAfterEvent)}>
                  {isLast ? '▶ Simular temporada' : 'Próximo evento →'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

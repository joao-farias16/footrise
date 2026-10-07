import { useState } from 'react';
import { POSITIONS } from '../../config/positions';
import { getCountry } from '../../data/countries';
import { formatMoney } from '../../engine/market';
import { useGame } from '../../state/GameContext';
import { ConfirmButton, EmptyState, Flag, ovrClass, PageHead, Pill, TopBar } from '../common';
import { AccountButton } from '../CloudWidgets';

type Sort = 'recent' | 'legacy';

export function HistoryScreen() {
  const { history, openHistoryCareer, removeHistoryCareer, goCreate, user, cloudAvailable, goAccount } = useGame();
  const [sort, setSort] = useState<Sort>('recent');
  const items = [...history].sort((a, b) => (sort === 'recent' ? b.summary.savedAt - a.summary.savedAt : b.summary.legacy.score - a.summary.legacy.score));
  const localOnly = history.filter((h) => !h.cloud).length;

  return (
    <>
      <TopBar right={<AccountButton />} />
      <main className="page page-narrow">
        <div className="stack">
          <PageHead
            eyebrow="Hall da fama pessoal"
            title="Minhas carreiras"
            aside={
              items.length > 1 && (
                <div className="segmented track" role="radiogroup" aria-label="Ordenar">
                  <button className="seg" role="radio" aria-checked={sort === 'recent'} onClick={() => setSort('recent')}>
                    Recentes
                  </button>
                  <button className="seg" role="radio" aria-checked={sort === 'legacy'} onClick={() => setSort('legacy')}>
                    Maior legado
                  </button>
                </div>
              )
            }
          />

          {cloudAvailable && !user && (
            <div className="tip">
              <span aria-hidden="true">☁️</span>
              <span>
                Estas carreiras estão salvas neste aparelho.{' '}
                <button className="btn btn-sm btn-ghost" onClick={goAccount}>
                  Entre na sua conta
                </button>{' '}
                para guardá-las também na nuvem.
              </span>
            </div>
          )}
          {cloudAvailable && user && localOnly > 0 && (
            <div className="tip">
              <span aria-hidden="true">📤</span>
              <span>
                {localOnly} carreira{localOnly > 1 ? 's' : ''} ainda só neste aparelho.{' '}
                <button className="btn btn-sm btn-ghost" onClick={goAccount}>
                  Enviar para a conta
                </button>
              </span>
            </div>
          )}

          {items.length === 0 && (
            <div className="panel">
              <EmptyState
                icon="📜"
                title="Nenhuma carreira salva"
                action={
                  <button className="btn btn-primary" onClick={goCreate}>
                    Começar uma carreira
                  </button>
                }
              >
                Ao se aposentar, escolha “Salvar carreira” para guardá-la aqui.
              </EmptyState>
            </div>
          )}

          {items.map(({ summary: s, local, cloud }) => {
            const isKeeper = POSITIONS[s.player.position].group === 'gk';
            return (
              <article className="history-card" key={s.careerId}>
                <div className="history-score" aria-label={`Pico de OVR ${s.evolution.peakOvr}`}>
                  <b>{s.evolution.peakOvr}</b>
                  <small>{s.legacy.tier}</small>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Flag code={s.player.nationality} />
                    <span className="history-name">{s.player.name}</span>
                    <Pill>{POSITIONS[s.player.position].label}</Pill>
                  </div>
                  <div className="faint history-meta">
                    <span>{getCountry(s.player.nationality).name}</span>
                    <span>
                      {s.player.startAge} → {s.player.retirementAge} anos · {s.player.careerYears} temporadas
                    </span>
                  </div>
                  <div className="history-stats">
                    <span className="history-stat">
                      Pico de OVR <strong className={ovrClass(s.evolution.peakOvr)}>{s.evolution.peakOvr}</strong>
                    </span>
                    <span className="history-stat">
                      OVR final <strong className={ovrClass(s.evolution.finalOvr)}>{s.evolution.finalOvr}</strong>
                    </span>
                    <span className="history-stat">
                      <strong>{s.totals.apps.toLocaleString('pt-BR')}</strong> jogos
                    </span>
                    <span className="history-stat">
                      <strong>{(isKeeper ? s.totals.cleanSheets : s.totals.goals).toLocaleString('pt-BR')}</strong> {isKeeper ? 'sem sofrer gols' : 'gols'}
                    </span>
                    <span className="history-stat">
                      <strong>{s.totals.assists.toLocaleString('pt-BR')}</strong> assistências
                    </span>
                    <span className="history-stat">
                      <strong>{s.trophies.length}</strong> títulos
                    </span>
                    <span className="history-stat">Valor máximo {formatMoney(s.evolution.peakValue)}</span>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    {local && <Pill>📱 Neste aparelho</Pill>}
                    {cloud && <Pill tone="blue">☁️ Na conta</Pill>}
                    <span className="faint">Salva em {new Date(s.savedAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="history-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => openHistoryCareer(s.careerId)}>
                    Ver carreira
                  </button>
                  <ConfirmButton
                    label="Excluir"
                    confirmLabel={cloud ? 'Excluir daqui e da conta?' : 'Excluir mesmo?'}
                    onConfirm={() => void removeHistoryCareer(s.careerId)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}

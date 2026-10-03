import { useState } from 'react';
import { POSITIONS } from '../../config/positions';
import { getCountry } from '../../data/countries';
import { formatMoney } from '../../engine/market';
import { useGame } from '../../state/GameContext';
import { ConfirmButton, Flag, ovrClass, Pill, TopBar } from '../common';
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
          <div className="row between">
            <div>
              <div className="eyebrow">Hall da fama pessoal</div>
              <h1>Minhas carreiras</h1>
            </div>
            {items.length > 1 && (
              <div className="segmented" role="radiogroup" aria-label="Ordenar">
                <button className="seg" role="radio" aria-checked={sort === 'recent'} onClick={() => setSort('recent')}>
                  Recentes
                </button>
                <button className="seg" role="radio" aria-checked={sort === 'legacy'} onClick={() => setSort('legacy')}>
                  Maior legado
                </button>
              </div>
            )}
          </div>

          {cloudAvailable && !user && (
            <p className="faint">
              Estas carreiras estão salvas neste aparelho.{' '}
              <button className="btn btn-sm btn-ghost" onClick={goAccount}>
                Entre na sua conta
              </button>{' '}
              para guardá-las também na nuvem.
            </p>
          )}
          {cloudAvailable && user && localOnly > 0 && (
            <p className="faint">
              {localOnly} carreira{localOnly > 1 ? 's' : ''} ainda só neste aparelho.{' '}
              <button className="btn btn-sm btn-ghost" onClick={goAccount}>
                Enviar para a conta
              </button>
            </p>
          )}

          {items.length === 0 && (
            <div className="panel empty stack" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem' }} aria-hidden="true">
                📜
              </span>
              <p>Nenhuma carreira salva ainda. Ao se aposentar, escolha “Salvar carreira” para guardá-la aqui.</p>
              <button className="btn btn-primary" onClick={goCreate}>
                Começar uma carreira
              </button>
            </div>
          )}

          {items.map(({ summary: s, local, cloud }) => {
            const isKeeper = POSITIONS[s.player.position].group === 'gk';
            return (
              <article className="history-card" key={s.careerId}>
                <div className="history-score" aria-label={`Legado ${s.legacy.score}`}>
                  <b>{s.legacy.score}</b>
                  <small>{s.legacy.tier}</small>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Flag code={s.player.nationality} />
                    <strong style={{ fontSize: '1.1rem' }}>{s.player.name}</strong>
                    <Pill>{POSITIONS[s.player.position].label}</Pill>
                  </div>
                  <div className="faint history-meta">
                    <span>{getCountry(s.player.nationality).name}</span>
                    <span>
                      {s.player.startAge} → {s.player.retirementAge} anos · {s.player.careerYears} temporadas
                    </span>
                  </div>
                  <div className="faint history-meta">
                    <span>
                      Pico de OVR <strong className={ovrClass(s.evolution.peakOvr)}>{s.evolution.peakOvr}</strong>
                    </span>
                    <span>
                      OVR final <strong className={ovrClass(s.evolution.finalOvr)}>{s.evolution.finalOvr}</strong>
                    </span>
                    <span>Valor máximo {formatMoney(s.evolution.peakValue)}</span>
                  </div>
                  <div className="faint history-meta">
                    <span>{s.totals.apps.toLocaleString('pt-BR')} jogos</span>
                    <span>
                      {(isKeeper ? s.totals.cleanSheets : s.totals.goals).toLocaleString('pt-BR')} {isKeeper ? 'sem sofrer gols' : 'gols'}
                    </span>
                    <span>{s.totals.assists.toLocaleString('pt-BR')} assistências</span>
                    <span>{s.trophies.length} títulos</span>
                  </div>
                  <div className="row" style={{ gap: 4, marginTop: 6 }}>
                    {local && <Pill>📱 Neste aparelho</Pill>}
                    {cloud && <Pill tone="blue">☁️ Na conta</Pill>}
                    <span className="faint">Salva em {new Date(s.savedAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="history-actions">
                  <button className="btn btn-sm" onClick={() => openHistoryCareer(s.careerId)}>
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

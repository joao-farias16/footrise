import { useState } from 'react';
import { getClub } from '../../data/clubs';
import { currentOverall } from '../../engine/career';
import { seasonLabel } from '../../engine/season';
import { useGame } from '../../state/GameContext';
import { Crest, Flag, Logo, Pill } from '../common';
import { AccountButton, Modal } from '../CloudWidgets';

const PHASE_LABEL: Record<string, string> = {
  draft: 'No draft',
  card: 'Carta revelada',
  'club-choice': 'Escolhendo clube',
  hub: 'Entre temporadas',
  event: 'Decisão pendente',
  'season-review': 'Resumo da temporada',
  offers: 'Janela de transferências',
};

export function HomeScreen() {
  const { savedCareer, retiredCareer, history, settings, goCreate, goHistory, continueCareer, updateSettings, openRetiredCareer, user, sync, cloudAvailable, goAccount } =
    useGame();
  const [showSettings, setShowSettings] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const best = history.reduce((m, h) => Math.max(m, h.summary.legacy.score), 0);
  const bestCareer = history.find((h) => h.summary.legacy.score === best)?.summary;

  return (
    <main className="home">
      <div className="home-inner">
        {cloudAvailable && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <AccountButton />
          </div>
        )}
        <div className="stack" style={{ alignItems: 'center', gap: 12 }}>
          <Logo />
          <p className="tagline">
            Monte um jogador impossível com o DNA de lendas. Viva a carreira. Construa um legado.
          </p>
        </div>

        {retiredCareer && (
          <div className="banner banner-gold" style={{ textAlign: 'left' }}>
            <span className="banner-icon" aria-hidden="true">
              📜
            </span>
            <span style={{ flex: 1 }}>
              A carreira de <strong>{retiredCareer.profile.name}</strong> foi encerrada e ainda não foi salva no histórico.
            </span>
            <button className="btn btn-sm btn-gold" onClick={openRetiredCareer}>
              Ver e salvar
            </button>
          </div>
        )}

        {savedCareer && (
          <div className="save-chip">
            {savedCareer.clubId ? <Crest clubId={savedCareer.clubId} /> : <Flag code={savedCareer.profile.nationality} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>
                {savedCareer.profile.name} · {savedCareer.position}
              </div>
              <div className="faint">
                {savedCareer.phase === 'draft'
                  ? `Draft · rodada ${savedCareer.draft.round}/${savedCareer.draft.totalRounds}`
                  : `${savedCareer.age} anos · ${getClub(savedCareer.clubId)?.name ?? 'Sem clube'} · ${seasonLabel(savedCareer.year)}`}
                {' · '}
                {PHASE_LABEL[savedCareer.phase] ?? ''}
              </div>
            </div>
            {savedCareer.phase !== 'draft' && (
              <div className="display-num" style={{ fontSize: '2rem' }} aria-label={`Overall ${currentOverall(savedCareer)}`}>
                {currentOverall(savedCareer)}
              </div>
            )}
          </div>
        )}
        {savedCareer && (
          <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: -10 }}>
            <Pill tone="green">💾 Carreira ativa salva neste aparelho</Pill>
            {user && sync.state === 'synced' && <Pill tone="blue">☁️ Sincronizada com {user.username}</Pill>}
            {user && sync.state === 'conflict' && <Pill tone="gold">⚠️ Versões diferentes na nuvem</Pill>}
            {cloudAvailable && !user && (
              <button className="pill" onClick={goAccount}>
                ☁️ Entre para salvar na nuvem
              </button>
            )}
          </div>
        )}

        <div className="stack" style={{ gap: 12 }}>
          {savedCareer && (
            <button className="btn btn-primary btn-xl btn-block" onClick={continueCareer}>
              Continuar carreira
            </button>
          )}
          {savedCareer ? (
            <button className="btn btn-xl btn-block" onClick={() => setConfirmNew(true)}>
              Nova carreira
            </button>
          ) : (
            <button className="btn btn-primary btn-xl btn-block" onClick={goCreate}>
              Nova carreira
            </button>
          )}
          <button className="btn btn-block" onClick={goHistory}>
            Minhas carreiras {history.length > 0 && `(${history.length})`}
          </button>
          <button className="btn btn-ghost btn-sm btn-block" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
            ⚙ Configurações
          </button>
        </div>

        {showSettings && (
          <div className="panel panel-tight stack" style={{ textAlign: 'left', gap: 12 }}>
            <label className="row between" style={{ cursor: 'pointer' }}>
              <span>Reduzir animações</span>
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => updateSettings({ reduceMotion: e.target.checked })}
                style={{ width: 22, height: 22 }}
              />
            </label>
            <p className="faint">
              Seu progresso é salvo automaticamente neste navegador
              {cloudAvailable ? (user ? ` e na conta ${user.username}.` : '. Entre na sua conta para salvar também na nuvem.') : '.'}
            </p>
          </div>
        )}

        {bestCareer && (
          <p className="faint">
            Seu recorde: <strong style={{ color: 'var(--gold)' }}>{best}/100 · {bestCareer.legacy.tier}</strong> com {bestCareer.player.name}
          </p>
        )}

        {confirmNew && savedCareer && (
          <Modal
            title="Carreira em andamento"
            onClose={() => setConfirmNew(false)}
            actions={
              <>
                <button className="btn" onClick={() => setConfirmNew(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setConfirmNew(false);
                    goCreate();
                  }}
                >
                  Descartar e criar nova carreira
                </button>
              </>
            }
          >
            <p>Você possui uma carreira em andamento. Se iniciar uma nova carreira, a carreira atual será descartada.</p>
            <p className="faint">
              Carreira atual: {savedCareer.profile.name}, {savedCareer.age} anos. Ela só é substituída quando a nova carreira começar de fato.
            </p>
          </Modal>
        )}

        <details className="panel panel-tight how-to">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como funciona</summary>
          <ol>
            <li>Crie seu jogador: país, idade, posição.</li>
            <li>No draft, roube um atributo de uma lenda por rodada. A posição muda o que importa.</li>
            <li>Escolha clubes, tome decisões e simule temporadas.</li>
            <li>Evolua, ganhe títulos, chegue à seleção — e envelheça.</li>
            <li>Ao se aposentar, receba sua nota de legado. Depois, tente superá-la.</li>
          </ol>
        </details>
      </div>
    </main>
  );
}

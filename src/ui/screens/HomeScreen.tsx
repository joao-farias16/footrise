import { useState } from 'react';
import { getClub } from '../../data/clubs';
import { currentOverall } from '../../engine/career';
import { seasonLabel } from '../../engine/season';
import { useGame } from '../../state/GameContext';
import { Banner, Crest, Flag, Logo, OvrBadge, Pill } from '../common';
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
  // Em telas largas há espaço: "Como funciona" já começa aberto ao lado do menu.
  const [howOpen] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches);
  const best = history.reduce((m, h) => Math.max(m, h.summary.legacy.score), 0);
  const bestCareer = history.find((h) => h.summary.legacy.score === best)?.summary;

  return (
    <main className="home">
      <div className="home-inner home-layout">
        {cloudAvailable && (
          <div className="home-top">
            <AccountButton />
          </div>
        )}

        <section className="home-hero">
          <span className="home-kicker eyebrow">Simulador de carreira</span>
          <Logo />
          <p className="tagline">Monte um jogador impossível com o DNA de lendas. Viva a carreira. Construa um legado.</p>
        </section>

        <section className="home-menu" aria-label="Menu principal">
          {retiredCareer && (
            <Banner
              tone="gold"
              icon="📜"
              actions={
                <button className="btn btn-sm btn-gold" onClick={openRetiredCareer}>
                  Ver e salvar
                </button>
              }
            >
              A carreira de <strong>{retiredCareer.profile.name}</strong> foi encerrada e ainda não foi salva no histórico.
            </Banner>
          )}

          {savedCareer && (
            <div className="stack stack-sm">
              <div className="save-card">
                {savedCareer.clubId ? <Crest clubId={savedCareer.clubId} /> : <span className="flag-lg"><Flag code={savedCareer.profile.nationality} /></span>}
                <div className="save-card-info">
                  <div className="save-card-kicker">Carreira em andamento</div>
                  <div className="save-card-name">
                    {savedCareer.profile.name} <span className="muted">· {savedCareer.position}</span>
                  </div>
                  <div className="faint">
                    {savedCareer.phase === 'draft'
                      ? `Draft · rodada ${savedCareer.draft.round}/${savedCareer.draft.totalRounds}`
                      : `${savedCareer.age} anos · ${getClub(savedCareer.clubId)?.name ?? 'Sem clube'} · ${seasonLabel(savedCareer.year)}`}
                    {' · '}
                    {PHASE_LABEL[savedCareer.phase] ?? ''}
                  </div>
                </div>
                {savedCareer.phase !== 'draft' && <OvrBadge value={currentOverall(savedCareer)} size="sm" />}
              </div>
              <div className="row row-tight">
                <Pill tone="green">💾 Salva neste aparelho</Pill>
                {user && sync.state === 'synced' && <Pill tone="blue">☁️ Sincronizada com {user.username}</Pill>}
                {user && sync.state === 'conflict' && <Pill tone="gold">⚠️ Versões diferentes na nuvem</Pill>}
                {cloudAvailable && !user && (
                  <button className="pill" onClick={goAccount}>
                    ☁️ Entre para salvar na nuvem
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="stack stack-sm">
            {savedCareer && (
              <button className="btn btn-primary btn-xl btn-block" onClick={continueCareer}>
                ▶ Continuar carreira
              </button>
            )}
            {savedCareer ? (
              <button className="btn btn-xl btn-block" onClick={() => setConfirmNew(true)}>
                Nova carreira
              </button>
            ) : (
              <button className="btn btn-primary btn-xl btn-block" onClick={goCreate}>
                ▶ Nova carreira
              </button>
            )}
            <button className="btn btn-block" onClick={goHistory}>
              🏛 Minhas carreiras {history.length > 0 && `(${history.length})`}
            </button>
            <button className="btn btn-ghost btn-sm btn-block" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
              ⚙ Configurações
            </button>
          </div>

          {showSettings && (
            <div className="panel panel-tight panel-flat stack stack-sm">
              <label className="check-row">
                <span>Reduzir animações</span>
                <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} />
              </label>
              <p className="faint">
                Seu progresso é salvo automaticamente neste navegador
                {cloudAvailable ? (user ? ` e na conta ${user.username}.` : '. Entre na sua conta para salvar também na nuvem.') : '.'}
              </p>
            </div>
          )}

          {bestCareer && (
            <p className="record">
              <span aria-hidden="true">🏆</span>
              <span>
                Seu recorde: <strong>{best}/100 · {bestCareer.legacy.tier}</strong> com {bestCareer.player.name}
              </span>
            </p>
          )}
        </section>

        <details className="panel panel-tight panel-flat how-to home-how" open={howOpen}>
          <summary>Como funciona</summary>
          <ol className="home-steps">
            <li>Crie seu jogador: país, idade, posição.</li>
            <li>No draft, roube um atributo de uma lenda por rodada. A posição muda o que importa.</li>
            <li>Escolha clubes, tome decisões e simule temporadas.</li>
            <li>Evolua, ganhe títulos, chegue à seleção — e envelheça.</li>
            <li>Ao se aposentar, receba sua nota de legado. Depois, tente superá-la.</li>
          </ol>
        </details>

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
      </div>
    </main>
  );
}

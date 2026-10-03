import { useState } from 'react';
import { CAREER } from '../../config/balance';
import { ATTR_META, POSITIONS, attrKeysFor } from '../../config/positions';
import { CONTINENTAL_CUP, getClub, getLeague } from '../../data/clubs';
import { announceRetirement, canRetire, currentOverall, isFinalAllowedSeason, potentialOverall, retireNow, startSeason } from '../../engine/career';
import { currentShirtNumber } from '../../engine/shirt';
import { expectedStartShare, formatMoney, marketValue } from '../../engine/market';
import { nationalCalendar } from '../../engine/national';
import { seasonLabel } from '../../engine/season';
import { deriveStyle } from '../../engine/style';
import { careerTotals } from '../../engine/summary';
import { useGame } from '../../state/GameContext';
import type { Career } from '../../types';
import { Bar, ConfirmButton, Crest, Flag, Meter, ovrClass, Pill, StatTile, TopBar } from '../common';
import { NationalPanel, SeasonList, TrophyShelf } from '../CareerWidgets';
import { SaveStatus } from '../CloudWidgets';
import { PlayerCard } from '../PlayerCard';

export function HubScreen({ career }: { career: Career }) {
  const { act } = useGame();
  const [retirePromptSeason, setRetirePromptSeason] = useState<number | null>(null);
  const club = getClub(career.clubId);
  if (!club) return null;
  const league = getLeague(club.leagueId);
  const parent = getClub(career.parentClubId);
  const ovr = currentOverall(career);
  const pot = potentialOverall(career);
  const share = expectedStartShare(ovr, club.strength, career.coachTrust, career.position);
  const totals = careerTotals(career);
  const last = career.seasons[career.seasons.length - 1];
  const season = seasonLabel(career.year);
  const justSigned = career.transfers.find((t) => t.season === season && t.toClubId === club.id);
  const keys = attrKeysFor(career.position);
  const isKeeper = POSITIONS[career.position].group === 'gk';
  const firstSeason = career.seasons.length === 0;

  return (
    <>
      <TopBar right={<SaveStatus />} />
      <main className="page">
        <div className="stack">
          <div className="hub-header">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Crest clubId={club.id} size="lg" />
              <div>
                <div className="eyebrow">Temporada {season}</div>
                <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)' }}>{club.name}</h1>
                <div className="row faint" style={{ gap: 6 }}>
                  <Flag code={league.country} /> {league.name} · {career.age} anos
                </div>
              </div>
            </div>
            <div className="row">
              {career.retireAnnounced && <Pill tone="gold">👋 Última temporada</Pill>}
              {parent && <Pill tone="blue">↔ Emprestado pelo {parent.name}</Pill>}
              {career.continentalQualified && <Pill tone="purple">⭐ {CONTINENTAL_CUP[league.continent].name}</Pill>}
            </div>
          </div>

          {justSigned && (
            <div className="banner banner-gold">
              <span className="banner-icon" aria-hidden="true">
                ✍️
              </span>
              <span>
                {justSigned.kind === 'loan' ? 'Empréstimo confirmado!' : 'Reforço anunciado!'} Bem-vindo ao <strong>{club.name}</strong>
                {justSigned.fee > 0 && ` — negócio de ${formatMoney(justSigned.fee)}`}.
              </span>
            </div>
          )}
          {canRetire(career) && !career.retireAnnounced && retirePromptSeason !== career.year && (
            <div className="banner banner-gold">
              <span className="banner-icon" aria-hidden="true">
                👋
              </span>
              <span style={{ flex: 1 }}>
                <strong>Você tem {career.age} anos. Deseja se aposentar?</strong>{' '}
                {isFinalAllowedSeason(career)
                  ? `Esta é a última temporada possível: aos ${CAREER.maxAge} anos a aposentadoria é obrigatória.`
                  : `Dos ${CAREER.canRetireAge} aos ${CAREER.maxAge - 1} anos a decisão é sua; aos ${CAREER.maxAge}, a aposentadoria é obrigatória.`}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <ConfirmButton className="btn btn-sm btn-danger" label="Sim, aposentar" confirmLabel="Confirmar aposentadoria" onConfirm={() => act(retireNow)} />
                <button className="btn btn-sm" onClick={() => setRetirePromptSeason(career.year)}>
                  Não, continuar
                </button>
              </span>
            </div>
          )}
          {!canRetire(career) && isFinalAllowedSeason(career) && (
            <div className="banner banner-gold">
              <span className="banner-icon" aria-hidden="true">
                ⏳
              </span>
              <span>Última temporada possível: aos {CAREER.maxAge} anos a aposentadoria é obrigatória.</span>
            </div>
          )}
          {firstSeason && (
            <div className="banner banner-green">
              <span className="banner-icon" aria-hidden="true">
                🚀
              </span>
              <span>Contrato assinado. Antes de cada temporada podem surgir decisões — escolha bem.</span>
            </div>
          )}

          <div className="hub-grid">
            <div className="stack">
              <PlayerCard
                name={career.profile.name}
                nationality={career.profile.nationality}
                position={career.position}
                number={currentShirtNumber(career)}
                ovr={ovr}
                attributes={career.attributes}
                style={deriveStyle(career.attributes, career.position)}
              />
              <div className="panel panel-tight stack" style={{ gap: 10 }}>
                <div className="panel-title" style={{ marginBottom: 0 }}>
                  <h3>Atributos</h3>
                  <span className="faint">
                    Potencial <strong className={ovrClass(pot)}>{pot}</strong>
                  </span>
                </div>
                {keys.map((k) => (
                  <div className="attr-row" key={k}>
                    <span className="attr-key">{ATTR_META[k].short}</span>
                    <span className={`attr-val ${ovrClass(career.attributes[k] ?? 0)}`} style={{ fontSize: '1.1rem' }}>
                      {career.attributes[k]}
                    </span>
                    <Bar value={career.attributes[k] ?? 0} marker={career.potential[k]} />
                    <span className="faint" style={{ minWidth: 26, textAlign: 'right' }} title="Potencial">
                      {career.potential[k]}
                    </span>
                  </div>
                ))}
                <p className="faint">A marca dourada é o potencial de cada atributo.</p>
              </div>
            </div>

            <div className="stack">
              <div className="stat-tiles">
                <StatTile label="Valor de mercado" value={formatMoney(marketValue(ovr, career.age, career.reputation))} />
                <StatTile label="Salário" value={formatMoney(career.weeklyWage)} sub="por semana" />
                <StatTile label="Titularidade" value={`${Math.round(share * 100)}%`} sub="prevista" />
                <StatTile label="Força do clube" value={club.strength} sub={`Liga ${league.strength}`} />
              </div>

              <div className="panel panel-tight stack" style={{ gap: 10 }}>
                <h3>Situação</h3>
                <Meter label="Moral" value={career.morale} />
                <Meter label="Confiança do técnico" value={career.coachTrust} />
                <Meter label="Reputação" value={career.reputation} color="var(--purple)" />
              </div>

              {last && last.headlines.length > 0 && (
                <div className="panel panel-tight stack" style={{ gap: 8 }}>
                  <h3>Última temporada</h3>
                  {last.headlines.slice(0, 5).map((h, i) => (
                    <div className="headline" key={i}>
                      {h}
                    </div>
                  ))}
                </div>
              )}

              <div className="panel panel-tight stack">
                <h3>Carreira</h3>
                <div className="stat-tiles">
                  <StatTile label="Jogos" value={totals.apps} />
                  <StatTile label={isKeeper ? 'Sem sofrer gols' : 'Gols'} value={isKeeper ? totals.cleanSheets : totals.goals} />
                  <StatTile label="Assistências" value={totals.assists} />
                  <StatTile label="Seleção" value={career.national.caps} sub={`${career.national.goals} gols`} />
                </div>
                <TrophyShelf career={career} />
              </div>

              <div className="panel panel-tight stack" style={{ gap: 10 }}>
                <h3>Seleção</h3>
                <NationalPanel career={career} compact />
                <div className="faint">
                  📅 Calendário {season}: {nationalCalendar(career.year + 1, career.profile.nationality).join(' · ')}
                </div>
              </div>

              <div className="panel panel-tight">
                <div className="panel-title">
                  <h3>Temporadas</h3>
                  <span className="faint">{career.seasons.length}</span>
                </div>
                <SeasonList career={career} />
              </div>
            </div>
          </div>

          <div className="action-bar">
            <button className="btn btn-primary btn-xl" onClick={() => act(startSeason)}>
              ▶ Jogar temporada {season}
            </button>
            {canRetire(career) && !career.retireAnnounced && (
              <button className="btn" onClick={() => act((c) => announceRetirement(c, true))}>
                Anunciar última temporada
              </button>
            )}
            {career.retireAnnounced && (
              <button className="btn" onClick={() => act((c) => announceRetirement(c, false))}>
                Desistir da aposentadoria
              </button>
            )}
            {canRetire(career) && (
              <ConfirmButton className="btn btn-danger" label="Aposentar agora" confirmLabel="Pendurar as chuteiras?" onConfirm={() => act(retireNow)} />
            )}
          </div>
          {!canRetire(career) && career.age >= CAREER.canRetireAge - 2 && (
            <p className="faint" style={{ textAlign: 'center' }}>
              A aposentadoria fica disponível a partir dos {CAREER.canRetireAge} anos.
            </p>
          )}
        </div>
      </main>
    </>
  );
}

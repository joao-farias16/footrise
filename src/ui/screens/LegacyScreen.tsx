import { useMemo, useState } from 'react';
import { ATTR_META, POSITIONS } from '../../config/positions';
import { getCountry } from '../../data/countries';
import { buildCareerSummary } from '../../engine/careerSummary';
import { formatMoney } from '../../engine/market';
import { useGame, type SaveCareerResult } from '../../state/GameContext';
import type { Career, CareerSummary, TrophyKind } from '../../types';
import { Banner, Bar, Crest, Flag, ovrClass, Pill, ratingClass, Spinner, StatTile, TopBar } from '../common';
import { SeasonTable, trophyIcon, TrophyChip } from '../CareerWidgets';
import { Modal } from '../CloudWidgets';
import { PlayerCard } from '../PlayerCard';

function ringColor(score: number): string {
  if (score >= 85) return 'var(--gold)';
  if (score >= 70) return 'var(--green)';
  if (score >= 50) return 'var(--blue)';
  return 'var(--text-faint)';
}

const BIG: TrophyKind[] = ['worldCup', 'continental', 'clubWorld', 'continentalNation', 'nationsLeague'];
const ORDER: TrophyKind[] = ['worldCup', 'continental', 'clubWorld', 'continentalNation', 'nationsLeague', 'league', 'cup'];

function trophyGroups(s: CareerSummary) {
  const map = new Map<string, { name: string; kind: TrophyKind; team: string; years: number[] }>();
  for (const t of s.trophies) {
    const key = `${t.name}|${t.team}`;
    const e = map.get(key) ?? { name: t.name, kind: t.kind, team: t.team, years: [] };
    e.years.push(t.year);
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.years.length - a.years.length);
}

const range = (from: string, to: string) => (from === to ? from : `${from} – ${to}`);

/** Tudo o que foi registrado na carreira (usado na aposentadoria e no histórico). */
export function CareerSummaryView({ s }: { s: CareerSummary }) {
  const isKeeper = POSITIONS[s.player.position].group === 'gk';
  const groups = trophyGroups(s);
  const big = groups.filter((g) => BIG.includes(g.kind));
  const nationalTitles = s.trophies.filter((t) => t.team === 'Seleção');
  const worldCups = s.national.tournaments.filter((t) => t.name === 'Copa do Mundo');
  const continental = s.national.tournaments.filter((t) => t.name !== 'Copa do Mundo');
  const worldAwards = s.awards.filter((a) => a.kind === 'world').length;
  const bestGoals = s.seasons.reduce((m, x) => Math.max(m, x.goals), 0);
  const bestRating = s.seasons.reduce((m, x) => Math.max(m, x.rating), 0);
  const biggest = s.transfers.filter((t) => t.kind === 'transfer').reduce<CareerSummary['transfers'][number] | undefined>((b, t) => (!b || t.fee > b.fee ? t : b), undefined);
  const clubNumbers = s.shirtNumbers.filter((n) => n.kind === 'club');
  const nationalNumber = s.shirtNumbers.find((n) => n.kind === 'national');

  return (
    <>
      <div className="stat-tiles">
        <StatTile accent label="Jogos" value={s.totals.apps.toLocaleString('pt-BR')} sub={`${s.totals.starts.toLocaleString('pt-BR')} como titular`} />
        <StatTile accent label={isKeeper ? 'Sem sofrer gols' : 'Gols'} value={(isKeeper ? s.totals.cleanSheets : s.totals.goals).toLocaleString('pt-BR')} />
        <StatTile accent label="Assistências" value={s.totals.assists.toLocaleString('pt-BR')} />
        <StatTile accent label="Títulos" value={s.trophies.length} sub={big.length > 0 ? `${big.reduce((t, g) => t + g.years.length, 0)} grandes` : undefined} />
      </div>
      <div className="stat-tiles stat-tiles-compact">
        <StatTile label="Nota média" value={<span className={ratingClass(s.totals.avgRating)}>{s.totals.avgRating > 0 ? s.totals.avgRating.toFixed(2) : '—'}</span>} sub="ponderada pelos jogos" />
        <StatTile label="Prêmios" value={s.awards.length} sub={worldAwards > 0 ? `${worldAwards}× Bola de Ouro` : undefined} />
        <StatTile label="Pico de OVR" value={<span className={ovrClass(s.evolution.peakOvr)}>{s.evolution.peakOvr}</span>} sub={s.evolution.peakOvrSeason ?? undefined} />
        <StatTile label="Maior valor" value={formatMoney(s.evolution.peakValue)} />
        <StatTile label="Salários recebidos" value={formatMoney(s.earnings.total)} sub={`pico de ${formatMoney(s.earnings.peakWeeklyWage)}/sem`} />
        <StatTile label="Minutos" value={s.totals.minutes.toLocaleString('pt-BR')} />
        <StatTile label="Cartões" value={`${s.totals.yellow}🟨 ${s.totals.red}🟥`} />
        <StatTile label="Seleção" value={s.national.caps} sub={`${s.national.goals} gols · ${s.national.assists} assist.`} />
      </div>

      {big.length > 0 && (
        <section className="panel panel-tight stack stack-sm">
          <h3>Maiores conquistas</h3>
          <div className="trophy-shelf">
            {big.map((t) => (
              <TrophyChip key={`${t.name}|${t.team}`} kind={t.kind} count={t.years.length} name={t.name} />
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
        <section className="panel panel-tight stack stack-sm">
          <h3>Como o legado foi calculado</h3>
          <div className="breakdown">
            {s.legacy.breakdown.map((b) => (
              <div className="breakdown-row" key={b.key}>
                <span>{b.label}</span>
                <Bar value={b.points} max={b.max} color="linear-gradient(90deg, var(--green), var(--volt))" />
                <span className="faint" style={{ textAlign: 'right' }}>
                  {b.points.toFixed(1)}/{b.max}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel panel-tight stack stack-sm">
          <h3>Recordes e destaques</h3>
          {!isKeeper && bestGoals > 0 && <div className="headline">⚽ Mais gols numa temporada: {bestGoals}</div>}
          {bestRating > 0 && <div className="headline">📊 Melhor nota média numa temporada: {bestRating.toFixed(2)}</div>}
          {biggest && (
            <div className="headline">
              💸 Maior transferência: {formatMoney(biggest.fee)} para o {biggest.toClub} ({biggest.season})
            </div>
          )}
          <div className="headline">💰 Total arrecadado em salários: {formatMoney(s.earnings.total)}</div>
          <div className="headline">
            <span>
              🎽 Camisa:{' '}
              {clubNumbers.map((n, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <strong>{n.number}</strong> no {n.team}
                </span>
              ))}
              {nationalNumber && (
                <span>
                  {' · '}
                  <strong>{nationalNumber.number}</strong> na seleção
                </span>
              )}
              <span className="faint"> (preferido: {s.player.preferredNumber})</span>
            </span>
          </div>
          {s.totals.injuries > 0 && (
            <div className="headline" style={{ borderLeftColor: 'var(--red)' }}>
              🩹 {s.totals.injuries} lesões · {s.totals.gamesInjured} jogos fora
            </div>
          )}
        </section>
      </div>

      <section className="panel panel-tight stack stack-sm">
        <h3>Clubes</h3>
        {s.clubs.map((c, i) => (
          <div className="spell" key={i}>
            <Crest clubId={c.clubId} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{c.name}</strong>
              {c.loan && <span className="faint"> (empréstimo)</span>}
              <div className="faint">
                {range(c.from, c.to)} · {c.apps} jogos · {isKeeper ? `${c.cleanSheets} sem sofrer gols` : `${c.goals} gols`} · {c.assists} assist. · nota{' '}
                {c.avgRating > 0 ? c.avgRating.toFixed(2) : '—'} · camisa {c.shirtNumbers.join(', ')}
              </div>
              {c.trophies.length > 0 && (
                <div className="row" style={{ gap: 4, marginTop: 6 }}>
                  {c.trophies.map((t, j) => (
                    <Pill tone="gold" key={j}>
                      🏆 {t.name} {Number(t.season.slice(0, 4)) + 1}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <section className="panel panel-tight stack stack-sm">
          <h3>Troféus</h3>
          {groups.length === 0 && <p className="empty-inline">🏆 Nenhum título na carreira.</p>}
          <div className="comp-list">
            {groups.map((g) => (
              <div className="comp won" key={`${g.name}|${g.team}`}>
                <span>
                  {trophyIcon(g.kind)} {g.name}
                  <span className="faint"> · {g.team}</span>
                </span>
                <strong>
                  {g.years.length > 1 ? `${g.years.length}× · ` : ''}
                  {g.years.join(', ')}
                </strong>
              </div>
            ))}
          </div>
          {s.awards.length > 0 && (
            <>
              <h3 style={{ marginTop: 8 }}>Prêmios individuais</h3>
              <div className="row row-tight">
                {s.awards.map((a, i) => (
                  <Pill tone="purple" key={i}>
                    🥇 {a.name} {Number(a.season.slice(0, 4)) + 1}
                  </Pill>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="panel panel-tight stack stack-sm">
          <h3>Seleção</h3>
          <div className="row row-tight">
            <Flag code={s.player.nationality} />
            <strong>{s.national.country}</strong>
            {s.national.debutSeason && <span className="faint">· estreia em {s.national.debutSeason}</span>}
          </div>
          {s.national.caps === 0 && s.national.callups === 0 ? (
            <p className="empty-inline">🌍 Nunca vestiu a camisa da seleção principal.</p>
          ) : (
            <>
              <div className="faint">
                Convocações: {s.national.callups} · Jogos: {s.national.caps} · Titularidades: {s.national.starts} · Gols: {s.national.goals} · Assistências:{' '}
                {s.national.assists}
              </div>
              {nationalTitles.length > 0 && (
                <div className="row row-tight">
                  {nationalTitles.map((t, i) => (
                    <Pill tone="gold" key={i}>
                      {trophyIcon(t.kind)} {t.name} {t.year}
                    </Pill>
                  ))}
                </div>
              )}
              {worldCups.length > 0 && <span className="eyebrow">Copas do Mundo</span>}
              <div className="comp-list">
                {worldCups.map((t, i) => (
                  <div className={`comp ${t.result === 'Campeão' ? 'won' : ''}`} key={`w${i}`}>
                    <span>{t.year}</span>
                    <strong>{t.result === 'Campeão' ? 'CAMPEÃO' : t.result}</strong>
                  </div>
                ))}
                {continental.map((t, i) => (
                  <div className={`comp ${t.result === 'Campeão' ? 'won' : ''}`} key={`c${i}`}>
                    <span>
                      {t.name} {t.year}
                    </span>
                    <strong>{t.result}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="panel panel-tight">
        <div className="panel-title">
          <h3>Temporada a temporada</h3>
          <span className="faint">{s.seasons.length}</span>
        </div>
        <SeasonTable
          isKeeper={isKeeper}
          rows={s.seasons.map((x) => ({
            season: x.season,
            age: x.age,
            clubId: x.clubId,
            clubName: x.clubName,
            loan: x.loan,
            detail: `${x.position}${x.shirtNumber !== undefined ? ` · #${x.shirtNumber}` : ''}`,
            apps: x.apps,
            main: isKeeper ? x.cleanSheets : x.goals,
            assists: x.assists,
            rating: x.rating,
            ovr: x.ovr,
            chips:
              x.trophies.length > 0 || x.awards.length > 0 || x.national.calledUp ? (
                <>
                  {x.trophies.map((t, i) => (
                    <Pill tone="gold" key={`t${i}`}>
                      🏆 {t}
                    </Pill>
                  ))}
                  {x.awards.map((a, i) => (
                    <Pill tone="purple" key={`a${i}`}>
                      🥇 {a}
                    </Pill>
                  ))}
                  {x.national.calledUp && (
                    <Pill tone="blue">
                      🌍 Seleção: {x.national.caps} J · {x.national.goals} G
                    </Pill>
                  )}
                </>
              ) : undefined,
          }))}
        />
      </section>

      <div className="grid-2">
        <section className="panel panel-tight stack stack-sm">
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <h3>Atributos finais</h3>
            <span className="faint">
              OVR final <strong className={ovrClass(s.evolution.finalOvr)}>{s.evolution.finalOvr}</strong>
            </span>
          </div>
          {Object.entries(s.evolution.finalAttributes).map(([k, v]) => (
            <div className="attr-row" key={k}>
              <span className="attr-key">{ATTR_META[k as keyof typeof ATTR_META].short}</span>
              <span className={`attr-val ${ovrClass(v ?? 0)}`}>{v}</span>
              <Bar value={v ?? 0} />
            </div>
          ))}
          <p className="faint">
            Principais: {s.evolution.topAttributes.map((a) => `${ATTR_META[a.key].label} ${a.value}`).join(' · ')}
          </p>
          {s.transfers.length > 0 && (
            <>
              <h3 style={{ marginTop: 8 }}>Transferências</h3>
              <div className="comp-list">
                {s.transfers.map((t, i) => (
                  <div className="comp" key={i}>
                    <span>
                      {t.season} · {t.fromClub} → {t.toClub}
                      {t.kind === 'loan' && <span className="faint"> (empréstimo)</span>}
                    </span>
                    <strong>{t.fee > 0 ? formatMoney(t.fee) : '—'}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        <div className="stack" style={{ alignItems: 'center' }}>
          <div className="card-stage">
            <PlayerCard
              name={s.player.name}
              nationality={s.player.nationality}
              position={s.player.position}
              number={s.player.preferredNumber}
              ovr={s.evolution.finalOvr}
              ovrLabel="Final"
              attributes={s.evolution.finalAttributes}
              style={s.evolution.style}
            />
          </div>
          <p className="faint center">
            Atributos finais · OVR final {s.evolution.finalOvr} · pico {s.evolution.peakOvr}
          </p>
        </div>
      </div>
    </>
  );
}

function LegacyHero({ s, retiring }: { s: CareerSummary; retiring: boolean }) {
  const p = s.player;
  return (
    <div className="legacy-hero">
      <div className="eyebrow">{retiring ? 'Fim de carreira' : 'Carreira salva'}</div>
      <h1 className="legacy-name">{p.name}</h1>
      <div className="row row-tight" style={{ justifyContent: 'center' }}>
        <Flag code={p.nationality} />
        <span className="muted">
          {getCountry(p.nationality).name} · {POSITIONS[p.position].label} · {p.startAge} → {p.retirementAge} anos · {p.careerYears} temporada
          {p.careerYears === 1 ? '' : 's'} ({range(p.firstSeason, p.lastSeason)})
        </span>
      </div>
      <div className="legacy-ring" style={{ ['--p' as string]: s.evolution.peakOvr, ['--ring' as string]: ringColor(s.evolution.peakOvr) }}>
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow">OVR máximo</div>
          <div className="legacy-score">{s.evolution.peakOvr}</div>
          <div className="faint">/ 100</div>
        </div>
      </div>
      <div className="legacy-tier">{s.legacy.tier}</div>
      <p className="muted" style={{ maxWidth: 540 }}>
        {s.legacy.tierDescription}
      </p>
      <p className="faint">
        {p.retirementReason ?? `Aposentou-se aos ${p.retirementAge} anos.`} · {new Date(p.retiredAt).toLocaleDateString('pt-BR')}
      </p>
    </div>
  );
}

/** Tela especial de encerramento: resumo completo + salvar carreira / nova carreira. */
function RetirementActions({ career, compact = false }: { career: Career; compact?: boolean }) {
  const { retiredCareer, saveRetiredCareer, discardRetiredCareer, goCreate, goHistory, user, cloudAvailable } = useGame();
  const saved = !retiredCareer || retiredCareer.id !== career.id;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveCareerResult | null>(null);
  const [askNew, setAskNew] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await saveRetiredCareer();
    setResult(r);
    setBusy(false);
    return r;
  };

  const saveLabel = busy ? (
    <>
      <Spinner /> Salvando…
    </>
  ) : (
    '💾 Salvar carreira'
  );

  return (
    <>
      {result && (
        <Banner tone={result.ok && result.cloud !== false ? 'green' : 'gold'} icon={result.ok ? '✓' : '⚠️'} role="status">
          {result.message}
        </Banner>
      )}
      {!saved && !result && (
        <Banner
          tone="gold"
          icon="📜"
          actions={
            compact ? (
              <button className="btn btn-sm btn-gold" disabled={busy} onClick={() => void save()}>
                {saveLabel}
              </button>
            ) : undefined
          }
        >
          A carreira foi encerrada. Salve para guardar o resumo completo no histórico
          {cloudAvailable ? (user ? ' e na sua conta' : ' (entre na sua conta para guardar também na nuvem)') : ''}.
        </Banner>
      )}
      {!compact && (
        <div className="action-bar">
          {!saved ? (
            <button className="btn btn-gold btn-xl" disabled={busy} onClick={() => void save()}>
              {saveLabel}
            </button>
          ) : (
            <Pill tone="green">✓ Carreira salva no histórico</Pill>
          )}
          <button className={`btn ${saved ? 'btn-primary btn-xl' : ''}`} onClick={() => (saved ? goCreate() : setAskNew(true))}>
            Nova carreira
          </button>
          <button className="btn" onClick={goHistory}>
            Minhas carreiras
          </button>
        </div>
      )}
      {askNew && (
        <Modal
          title="Carreira ainda não salva"
          onClose={() => setAskNew(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setAskNew(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  discardRetiredCareer();
                  goCreate();
                }}
              >
                Começar sem salvar
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void save().then((r) => {
                    if (r.ok) goCreate();
                    else setAskNew(false);
                  })
                }
              >
                Salvar e começar nova
              </button>
            </>
          }
        >
          <p className="muted">Se começar sem salvar, o resumo da carreira de {career.profile.name} não ficará no histórico.</p>
        </Modal>
      )}
    </>
  );
}

export function LegacyScreen({ career, summary }: { career?: Career; summary?: CareerSummary }) {
  const { goHistory, goHome } = useGame();
  const built = useMemo(() => (career ? buildCareerSummary(career, career.retiredAt ?? career.updatedAt) : null), [career]);
  const s = summary ?? built;
  if (!s) return null;
  const retiring = !!career;
  return (
    <>
      <TopBar onBack={retiring ? goHome : goHistory} backLabel={retiring ? 'Menu' : 'Histórico'} />
      <main className="page">
        <div className="stack reveal">
          <LegacyHero s={s} retiring={retiring} />
          {career && <RetirementActions career={career} compact />}
          <CareerSummaryView s={s} />
          {career && <RetirementActions career={career} />}
        </div>
      </main>
    </>
  );
}

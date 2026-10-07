import type { ReactNode } from 'react';
import { POSITIONS } from '../config/positions';
import { getCountry } from '../data/countries';
import type { Career } from '../types';
import { nationalSummary, trophyCounts } from '../engine/summary';
import { Crest, Flag, ovrClass, Pill, ratingClass, StatTile } from './common';

const TROPHY_ICON: Record<string, string> = {
  worldCup: '🌍',
  continental: '⭐',
  clubWorld: '🌐',
  continentalNation: '🏅',
  nationsLeague: '🎗️',
  league: '🏆',
  cup: '🥤',
};

export function trophyIcon(kind: string): string {
  return TROPHY_ICON[kind] ?? '🏆';
}

/** Um título na estante: ícone, quantidade e nome. */
export function TrophyChip({ kind, count, name }: { kind: string; count: number; name: string }) {
  return (
    <div className="trophy">
      <span className="trophy-icon" aria-hidden="true">
        {trophyIcon(kind)}
      </span>
      <span className="count">{count}×</span>
      <span className="name">{name}</span>
    </div>
  );
}

export function TrophyShelf({ career }: { career: Career }) {
  const counts = trophyCounts(career);
  if (counts.length === 0) return <p className="empty-inline">🏆 Nenhum título ainda. A estante está esperando.</p>;
  return (
    <div className="trophy-shelf">
      {counts.map((t) => (
        <TrophyChip key={t.name} kind={t.kind} count={t.count} name={t.name} />
      ))}
    </div>
  );
}

/** Uma linha da tabela de temporadas (carreira ativa e resumo salvo usam o mesmo formato). */
export interface SeasonRowData {
  season: string;
  age: number;
  clubId: string;
  clubName: string;
  loan?: boolean;
  /** Complemento discreto depois do clube (posição, número da camisa). */
  detail?: string;
  apps: number;
  /** Gols, ou jogos sem sofrer gols para goleiros. */
  main: number;
  assists: number;
  rating: number;
  ovr: number;
  chips?: ReactNode;
}

/** Tabela de temporadas: cartõezinhos em contêiner estreito, tabela em contêiner largo. */
export function SeasonTable({ rows, isKeeper }: { rows: SeasonRowData[]; isKeeper: boolean }) {
  return (
    <div className="season-list" role="list">
      <div className="season-row head" aria-hidden="true">
        <span>Temp.</span>
        <span>Idade</span>
        <span>Clube</span>
        <span className="num">J</span>
        <span className="num">{isKeeper ? 'SG' : 'G'}</span>
        <span className="num">A</span>
        <span className="num">Nota</span>
        <span className="num">OVR</span>
      </div>
      {rows.map((s) => (
        <div className="season-row" role="listitem" key={s.season}>
          <span className="season-label">{s.season}</span>
          <span className="age">{s.age} anos</span>
          <span className="club">
            <Crest clubId={s.clubId} size="sm" />
            <span>
              {s.clubName}
              {s.loan && ' (emp.)'}
              {s.detail && <span className="faint"> · {s.detail}</span>}
            </span>
          </span>
          <span className="num" data-label="J">
            {s.apps}
          </span>
          <span className="num" data-label={isKeeper ? 'SG' : 'G'}>
            {s.main}
          </span>
          <span className="num" data-label="A">
            {s.assists}
          </span>
          <span className={`num ${ratingClass(s.rating)}`} data-label="Nota">
            {s.rating > 0 ? s.rating.toFixed(2) : '—'}
          </span>
          <span className={`num ${ovrClass(s.ovr)}`} data-label="OVR">
            {s.ovr}
          </span>
          {s.chips && <span className="trophies">{s.chips}</span>}
        </div>
      ))}
    </div>
  );
}

export function SeasonList({ career, newestFirst = true }: { career: Career; newestFirst?: boolean }) {
  const isKeeper = POSITIONS[career.position].group === 'gk';
  const seasons = newestFirst ? [...career.seasons].reverse() : career.seasons;
  if (seasons.length === 0) return <p className="empty-inline">📅 Sua primeira temporada ainda vai começar.</p>;
  return (
    <SeasonTable
      isKeeper={isKeeper}
      rows={seasons.map((s) => ({
        season: s.season,
        age: s.age,
        clubId: s.clubId,
        clubName: s.clubName,
        loan: s.loan,
        detail: s.position,
        apps: s.apps,
        main: isKeeper ? s.cleanSheets : s.goals,
        assists: s.assists,
        rating: s.rating,
        ovr: s.ovrEnd,
        chips:
          s.trophies.length > 0 || s.awards.length > 0 || s.national.calledUp ? (
            <>
              {s.trophies.map((t, i) => (
                <Pill tone="gold" key={`t${i}`}>
                  {trophyIcon(t.kind)} {t.name}
                </Pill>
              ))}
              {s.awards.map((a, i) => (
                <Pill tone="purple" key={`a${i}`}>
                  🥇 {a.name}
                </Pill>
              ))}
              {s.national.calledUp && (
                <Pill tone="blue">
                  🌍 Seleção: {s.national.caps} J · {s.national.goals} G
                </Pill>
              )}
            </>
          ) : undefined,
      }))}
    />
  );
}

/** Ano em que a temporada termina ("2033/34" → 2034): é o ano dos torneios de seleção. */
export function seasonEndYear(season: string): number {
  return Number(season.slice(0, 4)) + 1;
}

/** Carreira internacional: números, títulos e campanhas em Copas e torneios continentais. */
export function NationalPanel({ career, compact = false }: { career: Career; compact?: boolean }) {
  const n = nationalSummary(career);
  const country = getCountry(career.profile.nationality);
  return (
    <div className="stack stack-sm">
      <div className="row row-tight">
        <Flag code={country.code} />
        <strong>{country.name}</strong>
        {n.debutSeason && <span className="faint">· estreia em {n.debutSeason}</span>}
      </div>
      {n.callups === 0 && n.caps === 0 ? (
        <p className="empty-inline">🌍 Ainda sem convocação para a seleção principal.</p>
      ) : (
        <>
          <div className="stat-tiles">
            <StatTile label="Convocações" value={n.callups} />
            <StatTile label="Jogos" value={n.caps} sub={n.starts > 0 ? `${n.starts} como titular` : undefined} />
            <StatTile label="Gols" value={n.goals} />
            <StatTile label="Assistências" value={n.assists} />
          </div>
          {n.titles.length > 0 && (
            <div className="row row-tight">
              {n.titles.map((t, i) => (
                <Pill tone="gold" key={i}>
                  {trophyIcon(t.kind)} {t.name} {t.year}
                </Pill>
              ))}
            </div>
          )}
          {n.worldCups.length > 0 && (
            <div className="stack stack-xs">
              <span className="eyebrow">Copas do Mundo</span>
              <div className="comp-list">
                {n.worldCups.map((t, i) => (
                  <div className={`comp ${t.result === 'Campeão' ? 'won' : ''}`} key={i}>
                    <span>
                      {t.result === 'Campeão' && <span aria-hidden="true">🏆 </span>}
                      {t.year}
                    </span>
                    <strong>{t.result === 'Campeão' ? 'CAMPEÃO' : t.result}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!compact && n.continental.length > 0 && (
            <div className="stack stack-xs">
              <span className="eyebrow">Torneios continentais</span>
              <div className="comp-list">
                {n.continental.map((t, i) => (
                  <div className={`comp ${t.result === 'Campeão' ? 'won' : ''}`} key={i}>
                    <span>
                      {t.result === 'Campeão' && <span aria-hidden="true">🏆 </span>}
                      {t.name} {t.year}
                    </span>
                    <strong>{t.result}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

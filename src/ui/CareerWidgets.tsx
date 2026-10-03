import { POSITIONS } from '../config/positions';
import { getCountry } from '../data/countries';
import type { Career, SeasonRecord } from '../types';
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

export function TrophyShelf({ career }: { career: Career }) {
  const counts = trophyCounts(career);
  if (counts.length === 0) return <p className="faint">Nenhum título ainda. A estante está esperando.</p>;
  return (
    <div className="trophy-shelf">
      {counts.map((t) => (
        <div className="trophy" key={t.name}>
          <span aria-hidden="true">{trophyIcon(t.kind)}</span>
          <span className="count">{t.count}×</span>
          <span className="name">{t.name}</span>
        </div>
      ))}
    </div>
  );
}

function SeasonRow({ s, isKeeper }: { s: SeasonRecord; isKeeper: boolean }) {
  const titles = s.trophies.length;
  return (
    <div className="season-row">
      <span className="season-label">{s.season}</span>
      <span className="age">{s.age} anos</span>
      <span className="club">
        <Crest clubId={s.clubId} size="sm" />
        <span>
          {s.clubName}
          {s.loan && ' (emp.)'}
          {s.position !== undefined && <span className="faint"> · {s.position}</span>}
        </span>
      </span>
      <span className="num" data-label="J">
        {s.apps}
      </span>
      <span className="num" data-label={isKeeper ? 'SG' : 'G'}>
        {isKeeper ? s.cleanSheets : s.goals}
      </span>
      <span className="num" data-label="A">
        {s.assists}
      </span>
      <span className={`num ${ratingClass(s.rating)}`} data-label="Nota">
        {s.rating > 0 ? s.rating.toFixed(2) : '—'}
      </span>
      <span className={`num ${ovrClass(s.ovrEnd)}`} data-label="OVR">
        {s.ovrEnd}
      </span>
      {(titles > 0 || s.awards.length > 0 || s.national.calledUp) && (
        <span className="trophies">
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
        </span>
      )}
    </div>
  );
}

export function SeasonList({ career, newestFirst = true }: { career: Career; newestFirst?: boolean }) {
  const isKeeper = POSITIONS[career.position].group === 'gk';
  const seasons = newestFirst ? [...career.seasons].reverse() : career.seasons;
  if (seasons.length === 0) return <p className="faint">Sua primeira temporada ainda vai começar.</p>;
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
      {seasons.map((s) => (
        <SeasonRow key={s.season} s={s} isKeeper={isKeeper} />
      ))}
    </div>
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
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <Flag code={country.code} />
        <strong>{country.name}</strong>
        {n.debutSeason && <span className="faint">· estreia em {n.debutSeason}</span>}
      </div>
      {n.callups === 0 && n.caps === 0 ? (
        <p className="faint">Ainda sem convocação para a seleção principal.</p>
      ) : (
        <>
          <div className="stat-tiles">
            <StatTile label="Convocações" value={n.callups} />
            <StatTile label="Jogos" value={n.caps} sub={n.starts > 0 ? `${n.starts} como titular` : undefined} />
            <StatTile label="Gols" value={n.goals} />
            <StatTile label="Assistências" value={n.assists} />
          </div>
          {n.titles.length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              {n.titles.map((t, i) => (
                <Pill tone="gold" key={i}>
                  {trophyIcon(t.kind)} {t.name} {t.year}
                </Pill>
              ))}
            </div>
          )}
          {n.worldCups.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
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
            <div className="stack" style={{ gap: 4 }}>
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

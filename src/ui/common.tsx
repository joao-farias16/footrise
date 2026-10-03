import { useEffect, useState, type ReactNode } from 'react';
import { getClub } from '../data/clubs';
import { getCountry } from '../data/countries';
import { LEGEND_BY_ID } from '../data/legends';
import { useGame } from '../state/GameContext';

export function Flag({ code, title }: { code: string; title?: string }) {
  const c = getCountry(code);
  return (
    <span className={`flag flag-${c.flagDir ?? 'h'}`} role="img" aria-label={title ?? c.name} title={c.name}>
      {c.flag.map((color, i) => (
        <span key={i} style={{ background: color }} />
      ))}
    </span>
  );
}

export function CountryName({ code }: { code: string }) {
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      <Flag code={code} />
      {getCountry(code).name}
    </span>
  );
}

export function Crest({ clubId, size = 'md' }: { clubId: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const club = getClub(clubId);
  const [a, b] = club?.colors ?? ['#334155', '#e2e8f0'];
  return (
    <span
      className={`crest ${size === 'sm' ? 'crest-sm' : size === 'lg' ? 'crest-lg' : ''}`}
      style={{ background: `linear-gradient(135deg, ${a} 0 55%, ${b} 55% 100%)`, color: '#fff' }}
      aria-hidden="true"
    >
      {club?.short ?? '?'}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.replace(/\./g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LegendAvatar({ legendId, size = 64 }: { legendId: string; size?: number }) {
  const legend = LEGEND_BY_ID[legendId];
  const country = getCountry(legend?.country ?? 'BRA');
  const [a, b = a, c = b] = country.flag;
  const second = b.toLowerCase() === '#ffffff' ? c : b;
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.35), transparent 45%), linear-gradient(135deg, ${a}, ${second})`,
      }}
      aria-hidden="true"
    >
      {initials(legend?.name ?? '?')}
    </span>
  );
}

export type PillTone = 'green' | 'gold' | 'red' | 'blue' | 'purple' | 'neutral';

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill ${tone === 'neutral' ? '' : `pill-${tone}`}`}>{children}</span>;
}

export function Bar({ value, max = 100, color = 'var(--green)', marker }: { value: number; max?: number; color?: string; marker?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar" role="presentation">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      {marker !== undefined && <div className="bar-pot" style={{ left: `calc(${Math.min(100, (marker / max) * 100)}% - 2px)` }} />}
    </div>
  );
}

export function meterColor(v: number): string {
  if (v >= 70) return 'var(--green)';
  if (v >= 45) return 'var(--gold)';
  return 'var(--red)';
}

export function Meter({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <Bar value={value} color={color ?? meterColor(value)} />
      <span className="meter-val">{Math.round(value)}</span>
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat-tile">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

/** Classe de cor para um valor de overall/atributo. */
export function ovrClass(v: number): string {
  if (v >= 88) return 'tier-elite';
  if (v >= 80) return 'tier-high';
  if (v >= 70) return 'tier-mid';
  return 'tier-low';
}

export function ratingClass(r: number): string {
  if (r >= 7.5) return 'tier-elite';
  if (r >= 7.0) return 'tier-high';
  if (r >= 6.5) return 'tier-mid';
  return 'tier-low';
}

export function ratingLabel(r: number): string {
  if (r === 0) return 'Sem jogos';
  if (r >= 7.8) return 'Brilhante';
  if (r >= 7.3) return 'Excelente';
  if (r >= 6.9) return 'Boa';
  if (r >= 6.5) return 'Regular';
  return 'Fraca';
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? 'logo-sm' : ''}`} aria-label="FootRise">
      <span>Foot</span>
      <span className="rise">Rise</span>
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="lg-rise" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#16e08a" />
            <stop offset="1" stopColor="#ffd166" />
          </linearGradient>
        </defs>
        <path d="M8 52 L28 32 L38 42 L56 18" stroke="url(#lg-rise)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M42 16 H58 V32" stroke="url(#lg-rise)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function TopBar({ right, onBack, backLabel = 'Menu' }: { right?: ReactNode; onBack?: () => void; backLabel?: string }) {
  const { goHome } = useGame();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="icon-btn" onClick={onBack ?? goHome} aria-label={backLabel}>
          <span aria-hidden="true">←</span> <span>{backLabel}</span>
        </button>
        <Logo small />
        <div className="row" style={{ justifyContent: 'flex-end', minWidth: 44 }}>
          {right}
        </div>
      </div>
    </header>
  );
}

/** Botão de confirmação em dois cliques (sem diálogos nativos). */
export function ConfirmButton({
  label,
  confirmLabel = 'Confirmar?',
  onConfirm,
  className = 'btn btn-sm btn-danger',
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={className} onClick={() => (armed ? onConfirm() : setArmed(true))} aria-live="polite">
      {armed ? confirmLabel : label}
    </button>
  );
}

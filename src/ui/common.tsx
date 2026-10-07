import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
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
    <span className="row row-tight" style={{ display: 'inline-flex' }}>
      <Flag code={code} />
      {getCountry(code).name}
    </span>
  );
}

export function Crest({ clubId, size = 'md' }: { clubId: string | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const club = getClub(clubId);
  const [a, b] = club?.colors ?? ['#334155', '#e2e8f0'];
  return (
    <span
      className={`crest ${size === 'md' ? '' : `crest-${size}`}`}
      style={{ background: `linear-gradient(135deg, ${a} 0 55%, ${b} 55% 100%)`, color: '#fff' }}
      aria-hidden="true"
    >
      {club?.short ?? '?'}
    </span>
  );
}

/** Variáveis CSS com as cores do clube (faixas e brilhos de cartões). */
export function clubColorVars(clubId: string | null | undefined): CSSProperties {
  const club = getClub(clubId);
  if (!club) return {};
  return { '--club-a': club.colors[0], '--club-b': club.colors[1] } as CSSProperties;
}

function initials(name: string): string {
  const parts = name.replace(/\./g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
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

export function UserAvatar({ name }: { name: string }) {
  return (
    <span className="user-avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export type PillTone = 'green' | 'gold' | 'red' | 'blue' | 'purple' | 'volt' | 'neutral';

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

export function StatTile({ label, value, sub, accent = false }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={`stat-tile ${accent ? 'stat-tile-accent' : ''}`}>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export type OvrTier = 'elite' | 'high' | 'mid' | 'low';

/** Faixa de um valor de overall/atributo (mesmos cortes de sempre). */
export function ovrTier(v: number): OvrTier {
  if (v >= 88) return 'elite';
  if (v >= 80) return 'high';
  if (v >= 70) return 'mid';
  return 'low';
}

/** Classe de cor para um valor de overall/atributo. */
export function ovrClass(v: number): string {
  return `tier-${ovrTier(v)}`;
}

/** Selo de OVR: o número mais importante do jogo, com a cor da faixa. */
export function OvrBadge({
  value,
  label = 'OVR',
  size = 'md',
  outline = false,
}: {
  value: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  outline?: boolean;
}) {
  return (
    <div
      className={`ovr-badge ${size === 'md' ? '' : `ovr-badge-${size}`} ${outline ? 'ovr-badge-outline' : ''}`}
      data-tier={ovrTier(value)}
      role="img"
      aria-label={`${label}: ${value}`}
    >
      <span className="ovr-badge-value">{value}</span>
      <span className="ovr-badge-label">{label}</span>
    </div>
  );
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

export type BannerTone = 'gold' | 'green' | 'red' | 'blue';

/** Aviso destacado no fluxo da página (contrato assinado, aposentadoria, títulos…). */
export function Banner({
  tone = 'gold',
  icon,
  children,
  actions,
  role,
}: {
  tone?: BannerTone;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={`banner banner-${tone}`} role={role}>
      {icon && (
        <span className="banner-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="banner-body">{children}</div>
      {actions && <div className="banner-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** Cabeçalho padrão de página: sobretítulo, título, subtítulo e um lado opcional. */
export function PageHead({ eyebrow, title, sub, aside }: { eyebrow: ReactNode; title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

/** Abas acessíveis (setas do teclado trocam de aba). */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  children,
}: {
  label: string;
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  children: ReactNode;
}) {
  const base = useId();
  const tabId = (id: T) => `${base}-tab-${id}`;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === value);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
    onChange(next);
    document.getElementById(tabId(next))?.focus();
  };
  return (
    <div className="tabs">
      <div className="segmented track" role="tablist" aria-label={label} onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(t.id)}
            className="seg"
            aria-selected={t.id === value}
            aria-controls={`${base}-panel`}
            tabIndex={t.id === value ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={tabId(value)} key={value}>
        {children}
      </div>
    </div>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  const gid = `lg-rise-${useId().replace(/:/g, '')}`;
  return (
    <span className={`logo ${small ? 'logo-sm' : ''}`} role="img" aria-label="FootRise">
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#34e39a" />
            <stop offset="1" stopColor="#d4ff3a" />
          </linearGradient>
        </defs>
        <path d="M10 4h44l6 6v30c0 10-12 18-28 22C16 58 4 50 4 40V10z" fill="#0c1814" stroke={`url(#${gid})`} strokeWidth="3" />
        <path d="M16 42 L28 30 L35 37 L48 22" stroke={`url(#${gid})`} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 21 H49 V32" stroke={`url(#${gid})`} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo-word" aria-hidden="true">
        <span>Foot</span>
        <span className="rise">Rise</span>
      </span>
    </span>
  );
}

export function TopBar({ right, onBack, backLabel = 'Menu' }: { right?: ReactNode; onBack?: () => void; backLabel?: string }) {
  const { goHome } = useGame();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="icon-btn topbar-back" onClick={onBack ?? goHome} aria-label={backLabel}>
          <span aria-hidden="true">←</span>
          <span className="topbar-back-label">{backLabel}</span>
        </button>
        <span className="topbar-brand">
          <Logo small />
        </span>
        <div className="topbar-right">{right}</div>
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
    <button className={`${className} ${armed ? 'is-armed' : ''}`} onClick={() => (armed ? onConfirm() : setArmed(true))} aria-live="polite">
      {armed ? confirmLabel : label}
    </button>
  );
}

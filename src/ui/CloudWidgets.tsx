import { useEffect, useRef, type ReactNode } from 'react';
import { getClub } from '../data/clubs';
import { currentOverall } from '../engine/career';
import { seasonLabel } from '../engine/season';
import { useGame } from '../state/GameContext';
import type { Career } from '../types';

/** Diálogo modal simples, acessível (foco no primeiro botão, Esc fecha quando permitido). */
export function Modal({ title, children, onClose, actions }: { title: string; children: ReactNode; onClose?: () => void; actions: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>('button')?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal panel stack" role="dialog" aria-modal="true" aria-label={title} ref={box}>
        <h2>{title}</h2>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

/** Linha curta que descreve uma carreira ativa (para avisos e conflitos). */
export function careerLine(c: Career | null): string {
  if (!c) return 'Nenhuma carreira ativa';
  const where = c.phase === 'draft' ? 'no draft' : `${getClub(c.clubId)?.name ?? 'sem clube'} · ${seasonLabel(c.year)}`;
  const ovr = c.phase === 'draft' ? '' : ` · ${currentOverall(c)} OVR`;
  return `${c.profile.name} · ${c.age} anos · ${where}${ovr}`;
}

function when(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Pílula de status da barra superior: no celular mostra só o ícone (texto fica para leitores de tela). */
function StatusPill({ tone, icon, text, onClick, title }: { tone: string; icon: string; text: string; onClick?: () => void; title?: string }) {
  const content = (
    <>
      <span aria-hidden="true">{icon}</span>
      <span className="pill-text">{text}</span>
    </>
  );
  return onClick ? (
    <button className={`pill pill-${tone}`} onClick={onClick} title={title ?? text}>
      {content}
    </button>
  ) : (
    // Falhas continuam com texto visível em qualquer tela.
    <span className={`pill pill-${tone} ${tone === 'red' ? '' : 'pill-compact'}`} title={title ?? text}>
      {content}
    </span>
  );
}

/** Onde a carreira está salva: neste aparelho e, se houver conta, na nuvem. */
export function SaveStatus() {
  const { localSave, user, sync, cloudAvailable, showConflict, syncNow } = useGame();
  return (
    <>
      {localSave.ok ? (
        <StatusPill tone="green" icon="💾" text="Salvo neste aparelho" />
      ) : (
        <StatusPill tone="red" icon="⚠️" text="Falha ao salvar neste navegador" />
      )}
      {cloudAvailable && user && sync.state === 'synced' && <StatusPill tone="blue" icon="☁️" text="Sincronizado" />}
      {cloudAvailable && user && (sync.state === 'saving' || sync.state === 'checking') && <StatusPill tone="blue" icon="☁️" text="Sincronizando…" />}
      {cloudAvailable && user && sync.state === 'error' && (
        <StatusPill tone="red" icon="☁️" text="Falhou · tentar de novo" onClick={syncNow} title={sync.message} />
      )}
      {cloudAvailable && user && sync.state === 'conflict' && <StatusPill tone="gold" icon="⚠️" text="Escolher versão" onClick={showConflict} />}
    </>
  );
}

const REASON_TEXT: Record<string, string> = {
  diverged: 'Esta carreira avançou neste aparelho e também em outro lugar. As duas versões são diferentes.',
  'different-career': 'Há uma carreira ativa neste aparelho e outra, diferente, salva na sua conta.',
  'deleted-elsewhere': 'Esta carreira foi encerrada ou substituída em outro aparelho, mas continua ativa aqui.',
  'other-account': 'A carreira deste aparelho foi sincronizada com outra conta.',
};

/** Escolha explícita entre a versão deste aparelho e a da nuvem. Nada é sobrescrito sem confirmação. */
export function ConflictDialog() {
  const { sync, resolveConflict, user } = useGame();
  const c = sync.conflict;
  if (sync.state !== 'conflict' || !c || c.deferred || !user) return null;
  const cloudLabel = c.reason === 'deleted-elsewhere' ? 'Remover deste aparelho' : 'Usar a da nuvem';
  return (
    <Modal
      title="Qual versão manter?"
      onClose={() => resolveConflict('later')}
      actions={
        <>
          <button className="btn btn-primary" onClick={() => resolveConflict('local')}>
            {c.reason === 'deleted-elsewhere' ? 'Manter e reenviar' : c.reason === 'other-account' ? `Enviar para ${user.username}` : 'Usar a deste aparelho'}
          </button>
          {(c.cloud || c.reason === 'deleted-elsewhere') && (
            <button className="btn" onClick={() => resolveConflict('cloud')}>
              {cloudLabel}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => resolveConflict('later')}>
            Decidir depois
          </button>
        </>
      }
    >
      <p className="muted">{REASON_TEXT[c.reason]}</p>
      <div className="comp-list">
        <div className="comp">
          <span>📱 Neste aparelho</span>
          <strong>{careerLine(c.local)}</strong>
        </div>
        {c.local && <div className="faint">Última alteração: {when(c.local.updatedAt)}</div>}
        <div className="comp">
          <span>☁️ Na nuvem</span>
          <strong>{careerLine(c.cloud)}</strong>
        </div>
        {c.cloud && <div className="faint">Última alteração: {when(c.cloud.updatedAt)}</div>}
      </div>
      <p className="faint">
        A versão escolhida substitui a outra. Ao usar a da nuvem, uma cópia da versão deste aparelho fica guardada como segurança. Até você
        escolher, a sincronização fica pausada e nada é apagado.
      </p>
    </Modal>
  );
}

/** Aviso passageiro (ex.: "carreira carregada da nuvem"). */
export function Notice() {
  const { notice, dismissNotice } = useGame();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, 6000);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);
  if (!notice) return null;
  return (
    <div className="toast" role="status">
      <span>{notice}</span>
      <button className="icon-btn" onClick={dismissNotice} aria-label="Fechar aviso">
        ✕
      </button>
    </div>
  );
}

/** Conta conectada (ou botão para entrar), no canto da barra superior. */
export function AccountButton() {
  const { cloudAvailable, user, goAccount, authReady } = useGame();
  if (!cloudAvailable || !authReady) return null;
  return (
    <button className="btn btn-sm btn-ghost account-btn" onClick={goAccount} aria-label={user ? `Conta: ${user.username}` : 'Entrar'} title={user?.username}>
      <span aria-hidden="true">{user ? '👤' : '☁️'}</span>
      <span>{user ? user.username : 'Entrar'}</span>
    </button>
  );
}

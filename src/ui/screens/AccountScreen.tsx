import { useState } from 'react';
import { useGame } from '../../state/GameContext';
import { Banner, EmptyState, PageHead, Pill, Spinner, TopBar, UserAvatar } from '../common';
import { SaveStatus } from '../CloudWidgets';

type Tab = 'signin' | 'signup' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateSignUp(f: { username: string; email: string; password: string; confirm: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const username = f.username.trim();
  if (username.length < 2) errors.username = 'Digite um nome de usuário com pelo menos 2 caracteres.';
  else if (username.length > 24) errors.username = 'Máximo de 24 caracteres.';
  if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Digite um e-mail válido.';
  if (!f.password) errors.password = 'Digite uma senha.';
  else if (f.password.length < 6) errors.password = 'A senha precisa ter pelo menos 6 caracteres.';
  if (f.confirm !== f.password) errors.confirm = 'As senhas não conferem.';
  return errors;
}

function Field({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function AccountScreen() {
  const { user, cloudAvailable, signIn, signUp, signOut, resetPassword, history, uploadLocalHistory, sync, syncNow, goHome } = useGame();
  const [tab, setTab] = useState<Tab>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'red' | 'green'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setPassword('');
      setConfirm('');
      if (success) setMessage({ tone: 'green', text: success });
    } catch (err) {
      setMessage({ tone: 'red', text: err instanceof Error ? err.message : 'Algo deu errado.' });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'signup') {
      const errs = validateSignUp({ username, email, password, confirm });
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;
      void run(() => signUp(username.trim(), email.trim(), password));
    } else if (tab === 'signin') {
      const errs: Record<string, string> = {};
      if (!EMAIL_RE.test(email.trim())) errs.email = 'Digite um e-mail válido.';
      if (!password) errs.password = 'Digite a senha.';
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;
      void run(() => signIn(email.trim(), password));
    } else {
      if (!EMAIL_RE.test(email.trim())) {
        setErrors({ email: 'Digite um e-mail válido.' });
        return;
      }
      setErrors({});
      void run(() => resetPassword(email.trim()), 'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha.');
    }
  };

  if (!cloudAvailable) {
    return (
      <>
        <TopBar />
        <main className="page page-narrow">
          <div className="panel auth-wrap">
            <EmptyState
              icon="💾"
              title="Conta indisponível"
              action={
                <button className="btn btn-primary" onClick={goHome}>
                  Voltar
                </button>
              }
            >
              O salvamento na nuvem não está disponível nesta versão. Seu progresso continua salvo neste navegador.
            </EmptyState>
          </div>
        </main>
      </>
    );
  }

  const busyLabel = (
    <>
      <Spinner /> Aguarde…
    </>
  );

  if (user) {
    const localOnly = history.filter((h) => h.local && !h.cloud).length;
    return (
      <>
        <TopBar right={<SaveStatus />} />
        <main className="page page-narrow">
          <div className="stack auth-wrap">
            <div className="row nowrap" style={{ gap: 16 }}>
              <UserAvatar name={user.username} />
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow">Conta conectada</div>
                <h1 className="ellipsis" style={{ fontSize: 'clamp(1.8rem, 6vw, 2.6rem)' }}>
                  {user.username}
                </h1>
                <p className="muted ellipsis">{user.email}</p>
              </div>
            </div>
            <section className="panel stack stack-sm">
              <h3>Salvamento</h3>
              <p className="muted">
                A carreira ativa é salva neste aparelho a cada ação e enviada para a sua conta automaticamente. Carreiras encerradas ficam no
                histórico quando você escolhe “Salvar carreira”.
              </p>
              <div className="row">
                {sync.state === 'synced' && <Pill tone="blue">☁️ Tudo sincronizado</Pill>}
                {(sync.state === 'saving' || sync.state === 'checking') && <Pill tone="blue">☁️ Sincronizando…</Pill>}
                {sync.state === 'error' && <Pill tone="red">☁️ {sync.message}</Pill>}
                {sync.state === 'conflict' && <Pill tone="gold">⚠️ Há duas versões da carreira esperando sua escolha</Pill>}
                <button className="btn btn-sm" onClick={syncNow}>
                  Sincronizar agora
                </button>
              </div>
              {localOnly > 0 && (
                <Banner
                  tone="gold"
                  icon="📤"
                  actions={
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void run(async () => setMessage({ tone: 'green', text: `${await uploadLocalHistory()} carreira(s) enviada(s) para a sua conta.` }))}
                    >
                      {busy ? busyLabel : 'Enviar para a conta'}
                    </button>
                  }
                >
                  {localOnly} carreira{localOnly > 1 ? 's' : ''} salva{localOnly > 1 ? 's' : ''} só neste aparelho.
                </Banner>
              )}
            </section>
            {message && (
              <Banner tone={message.tone} icon={message.tone === 'green' ? '✓' : '⚠️'} role={message.tone === 'red' ? 'alert' : 'status'}>
                {message.text}
              </Banner>
            )}
            <div className="action-bar">
              <button className="btn btn-primary" onClick={goHome}>
                Voltar ao menu
              </button>
              <button className="btn" disabled={busy} onClick={() => void run(signOut)}>
                Sair da conta
              </button>
            </div>
            <p className="faint center">Ao sair, as carreiras continuam salvas neste aparelho e na sua conta.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="page page-narrow">
        <form className="stack auth-wrap" onSubmit={submit} noValidate>
          <PageHead
            eyebrow="Salvamento na nuvem"
            title={tab === 'signup' ? 'Criar conta' : tab === 'signin' ? 'Entrar' : 'Recuperar senha'}
            sub="Com uma conta, sua carreira fica salva na nuvem e pode ser continuada em outro aparelho. Sem conta, tudo continua salvo neste navegador."
          />
          <div className="segmented track auth-tabs" role="tablist">
            <button type="button" className="seg" role="tab" aria-selected={tab === 'signin'} onClick={() => setTab('signin')}>
              Entrar
            </button>
            <button type="button" className="seg" role="tab" aria-selected={tab === 'signup'} onClick={() => setTab('signup')}>
              Criar conta
            </button>
          </div>
          <div className="panel stack">
            {tab === 'signup' && <Field id="username" label="Nome de usuário" value={username} onChange={setUsername} error={errors.username} autoComplete="username" />}
            <Field id="email" label="E-mail" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
            {tab !== 'reset' && (
              <Field
                id="password"
                label="Senha"
                type="password"
                value={password}
                onChange={setPassword}
                error={errors.password}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              />
            )}
            {tab === 'signup' && (
              <Field id="confirm" label="Confirmar senha" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />
            )}
            {message && (
              <Banner tone={message.tone} icon={message.tone === 'green' ? '✓' : '⚠️'} role={message.tone === 'red' ? 'alert' : 'status'}>
                {message.text}
              </Banner>
            )}
            <button type="submit" className="btn btn-primary btn-xl btn-block" disabled={busy} aria-busy={busy}>
              {busy ? busyLabel : tab === 'signup' ? 'Criar conta' : tab === 'signin' ? 'Entrar' : 'Enviar link'}
            </button>
            {tab === 'signin' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('reset')}>
                Esqueci minha senha
              </button>
            )}
            {tab === 'reset' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('signin')}>
                Voltar para entrar
              </button>
            )}
          </div>
          <button type="button" className="btn btn-ghost" onClick={goHome}>
            Jogar sem conta
          </button>
        </form>
      </main>
    </>
  );
}

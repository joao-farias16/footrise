import { Component, type ErrorInfo, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../state/storage';

interface State {
  error: Error | null;
}

/** Última linha de defesa: evita tela branca e oferece recuperação. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FootRise: erro inesperado', error, info);
  }

  private reload = () => window.location.reload();

  private resetCurrent = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.current);
    } catch {
      /* ignora */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="home">
        <div className="home-inner panel">
          <span className="empty-state-icon" aria-hidden="true" style={{ alignSelf: 'center' }}>
            ⚠️
          </span>
          <h2 className="center">Algo saiu do roteiro</h2>
          <p className="muted center">Um erro inesperado aconteceu. Seu histórico de carreiras continua salvo.</p>
          <button className="btn btn-primary btn-block" onClick={this.reload}>
            Recarregar
          </button>
          <button className="btn btn-danger btn-block" onClick={this.resetCurrent}>
            Descartar carreira atual e recarregar
          </button>
        </div>
      </main>
    );
  }
}

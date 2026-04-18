import { Component } from 'react';
import { logger } from '../utils/logger';
import './ErrorBoundary.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logger.log('error', error.message, {
      stack: error.stack?.slice(0, 300),
      component: info.componentStack?.slice(0, 200),
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-icon">⚠️</div>
          <h2>Bir şeyler ters gitti</h2>
          <p className="error-message">{this.state.error.message}</p>
          <p className="error-hint">Hata kaydedildi. Devam etmek için tekrar dene.</p>
          <div className="error-actions">
            <button
              className="btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Tekrar Dene
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                logger.log('system', 'user triggered full reset from error boundary');
                localStorage.clear();
                window.location.reload();
              }}
            >
              Sıfırla ve Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

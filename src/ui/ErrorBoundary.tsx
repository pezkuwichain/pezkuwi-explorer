import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';

type Props = WithTranslation & { children: ReactNode };

// A render error in one screen must not blank the whole app; show the plain error message with a retry.
class Boundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { /* nothing sensitive to report; the fallback is the signal */ }
  render() {
    const { t, children } = this.props;
    if (!this.state.failed) return children;
    return (
      <p role="alert">{t('state.error')} <button onClick={() => this.setState({ failed: false })}>{t('state.retry')}</button></p>
    );
  }
}
export const ErrorBoundary = withTranslation()(Boundary);

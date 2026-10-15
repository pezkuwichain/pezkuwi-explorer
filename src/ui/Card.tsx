import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Status = 'loading' | 'ok' | 'error' | 'preparing';

// A surface whose content shows only once its data is in; loading, preparing and error each say so in place.
export function Card({ title, status, onRetry, className = '', label, children }: {
  title?: ReactNode; status: Status; onRetry?: () => void; className?: string; label?: string; children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={`card card-${status} ${className}`.trim()} aria-busy={status === 'loading'} aria-label={label}>
      {title && <h2 className="card-title">{title}</h2>}
      {status === 'loading' && <p className="card-note">{t('state.loading')}</p>}
      {status === 'preparing' && <p className="card-note">{t('state.preparing')}</p>}
      {status === 'error' && <p className="card-note">{t('state.error')} {onRetry && <button type="button" className="retry" onClick={onRetry}>{t('state.retry')}</button>}</p>}
      {status === 'ok' && children}
    </section>
  );
}

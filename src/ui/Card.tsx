import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Status = 'loading' | 'ok' | 'error' | 'preparing';

export function Card({ title, status, onRetry, children }: { title: string; status: Status; onRetry?: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className={`card card-${status}`} aria-busy={status === 'loading'}>
      <h2>{title}</h2>
      {status === 'loading' && <p>{t('state.loading')}</p>}
      {status === 'preparing' && <p>{t('state.preparing')}</p>}
      {status === 'error' && <p>{t('state.error')} {onRetry && <button onClick={onRetry}>{t('state.retry')}</button>}</p>}
      {status === 'ok' && children}
    </section>
  );
}

import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadLiveness } from '../data/network';

// Rule: loading -> checking; live === true -> up; anything else (down, null, failed load) -> down.
export function Light({ status, live }: { status: 'loading' | 'ok' | 'error'; live?: boolean | null }) {
  const { t } = useTranslation();
  const key = status === 'loading' ? 'checking' : status === 'ok' && live === true ? 'up' : 'down';
  return <p className={`light light-${key}`} role="status"><span aria-hidden="true">●</span> {t(`status.${key}`)}</p>;
}

export default function StatusLight() {
  const s = useAsync(() => loadLiveness(), []);
  return <Light status={s.status} live={s.data} />;
}

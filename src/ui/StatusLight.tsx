import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadLiveness } from '../data/network';
import { liveKey } from './liveKey';

export function Light({ status, live }: { status: 'loading' | 'ok' | 'error'; live?: boolean | null }) {
  const { t } = useTranslation();
  const key = liveKey(status, live);
  return <p className={`light light-${key}`} role="status"><span className="dot" aria-hidden="true" /> {t(`status.${key}`)}</p>;
}

export default function StatusLight() {
  const s = useAsync(() => loadLiveness(), []);
  return <Light status={s.status} live={s.data} />;
}

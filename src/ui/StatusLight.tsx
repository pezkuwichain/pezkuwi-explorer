import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadNetwork } from '../data/network';

export default function StatusLight() {
  const { t } = useTranslation();
  const s = useAsync(() => loadNetwork(), []);
  const key = s.status === 'loading' ? 'checking' : s.status === 'ok' && s.data?.live === true ? 'up' : 'down';
  return <p className={`light light-${key}`} role="status"><span aria-hidden="true">●</span> {t(`status.${key}`)}</p>;
}

import { useTranslation } from 'react-i18next';
import type { Activity } from '../data/history';
import { IconFailed, IconReceived, IconSent, IconCheck } from './icons';

// The square chip that leads an activity row: received (green), sent (gold), failed (red), anything else neutral.
// Its accessible name is the outcome, so a row always says whether it went through.
export function ActivityChip({ a }: { a: Activity }) {
  const { t } = useTranslation();
  const tone = !a.ok ? 'bad' : a.direction === 'received' ? 'ok' : a.direction === 'sent' ? 'zer' : 'plain';
  const Icon = !a.ok ? IconFailed : a.direction === 'received' ? IconReceived : a.direction === 'sent' ? IconSent : IconCheck;
  return (
    <span className={`row-chip chip-${tone}`} role="img" aria-label={t(a.ok ? 'account.ok' : 'account.failed')}>
      <Icon size={20} />
    </span>
  );
}

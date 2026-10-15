import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Activity } from '../data/history';
import { Addr, Amount } from '../ui/Layout';
import { ActivityAmount } from '../ui/ActivityAmount';
import { NETWORK } from '../config/network';

export default function ActivityDetail() {
  const { t, i18n } = useTranslation();
  const a = useLocation().state as Activity | null;
  if (!a) return <Navigate to="/account" replace />;
  return (
    <div className="stack detail">
      <p className={`big-mark ${a.ok ? 'ok' : 'failed'}`} role="img" aria-label={t(a.ok ? 'account.ok' : 'account.failed')}>{a.ok ? '✅' : '❌'}</p>
      <h1><ActivityAmount a={a} /></h1>
      {a.counterparty && <p>{t(a.direction === 'sent' ? 'account.to' : 'account.from')}: <Addr value={a.counterparty} /></p>}
      <p>{t('account.when')}: {new Date(a.when * 1000).toLocaleString(i18n.language)}</p>
      <p>{t('account.fee')}: <Amount value={a.fee} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></p>
    </div>
  );
}

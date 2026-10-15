import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import type { Activity } from '../data/history';
import { Addr, Amount } from '../ui/Layout';
import { ActivityAmount } from '../ui/ActivityAmount';
import { NETWORK } from '../config/network';

// Router state is untrusted input (it can be stale or hand-built): accept it only when it is a well-formed Activity for this URL.
function asActivity(state: unknown, id: string | undefined): Activity | null {
  if (typeof state !== 'object' || state === null) return null;
  const a = state as Record<string, unknown>;
  const ok =
    typeof id === 'string' && a.id === id &&
    typeof a.when === 'number' && Number.isFinite(a.when) &&
    (a.direction === 'sent' || a.direction === 'received' || a.direction === 'other') &&
    (a.counterparty === null || typeof a.counterparty === 'string') &&
    typeof a.symbol === 'string' &&
    (a.decimals === null || (typeof a.decimals === 'number' && Number.isInteger(a.decimals) && a.decimals >= 0)) &&
    typeof a.amount === 'bigint' && typeof a.fee === 'bigint' && typeof a.ok === 'boolean';
  return ok ? (state as Activity) : null;
}

export default function ActivityDetail() {
  const { t, i18n } = useTranslation();
  const { address } = useAccount();
  const { id } = useParams();
  const raw = useLocation().state;
  if (!address) return <Navigate to="/account/open" replace />;
  let decoded: string | undefined;
  try { decoded = id === undefined ? undefined : decodeURIComponent(id); } catch { decoded = undefined; }
  const a = asActivity(raw, decoded);
  if (!a) return <Navigate to="/account" replace />;
  return (
    <div className="stack detail">
      <p className={`big-mark ${a.ok ? 'ok' : 'failed'}`} role="img" aria-label={t(a.ok ? 'account.ok' : 'account.failed')}>{a.ok ? '✅' : '❌'}</p>
      <h1><ActivityAmount a={a} />{!a.ok && <> · {t('account.failed')}</>}</h1>
      {a.counterparty && <p>{t(a.direction === 'sent' ? 'account.to' : 'account.from')}: <Addr value={a.counterparty} /></p>}
      <p>{t('account.when')}: {new Date(a.when * 1000).toLocaleString(i18n.language)}</p>
      <p>{t('account.fee')}: <Amount value={a.fee} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></p>
    </div>
  );
}

import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { validCode, type Activity } from '../data/history';
import { Addr, Amount } from '../ui/Layout';
import { ActivityAmount } from '../ui/ActivityAmount';
import { NETWORK } from '../config/network';
import { intlTag } from '../lib/format';
import PageHeader from '../ui/PageHeader';
import { TokenIcon } from '../ui/assetIcons';
import { IconCheck, IconCross } from '../ui/icons';

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
  // A code that is not 0x + 64 hex digits is no code at all; the rest of the entry is still good.
  return ok ? { ...(state as Activity), code: validCode(a.code) } : null;
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
    <>
      <PageHeader title={t('account.activity')} />
      <div className="screen verdict">
        <p className={`big-mark ${a.ok ? 'mark-ok' : 'mark-bad'}`} role="img" aria-label={t(a.ok ? 'account.ok' : 'account.failed')}>
          {a.ok ? <IconCheck stroke={2.4} /> : <IconCross stroke={2.4} />}
        </p>
        <h2 className="verdict-word">{t(a.ok ? 'account.ok' : 'account.failed')}</h2>
        <dl className="facts">
          <div className="fact fact-amount"><dt className="lead"><TokenIcon symbol={a.symbol} size={32} />{t('account.amount')}</dt><dd><ActivityAmount a={a} /></dd></div>
          {a.counterparty && <div className="fact"><dt>{t(a.direction === 'sent' ? 'account.to' : 'account.from')}</dt><dd><Addr value={a.counterparty} /></dd></div>}
          <div className="fact"><dt>{t('account.when')}</dt><dd>{new Date(a.when * 1000).toLocaleString(intlTag(i18n.language))}</dd></div>
          {a.code && <div className="fact"><dt>{t('account.code')}</dt><dd><bdi dir="ltr" className="code">{a.code}</bdi></dd></div>}
          <div className="fact"><dt>{t('account.fee')}</dt><dd><Amount value={a.fee} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></dd></div>
        </dl>
      </div>
    </>
  );
}

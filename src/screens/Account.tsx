import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadBalances } from '../data/balances';
import { loadActivity, NotIndexedError, type Activity } from '../data/history';
import { Card } from '../ui/Card';
import { Addr } from '../ui/Layout';
import PageHeader from '../ui/PageHeader';
import { ActivityAmount } from '../ui/ActivityAmount';
import { ActivityChip } from '../ui/ActivityChip';
import { HoldingsTokens, HoldingsTotal } from '../ui/Holdings';
import { IconWallet } from '../ui/icons';
import { dayKey, dayLabel, relativeTime } from '../lib/format';
import { useNow } from '../hooks/useNow';
import { shortAddress } from '../lib/address';
import './Account.css';

type Hist = { status: 'loading' | 'ok' | 'error' | 'preparing'; data?: Activity[] };

// The signed-in address. Tapping it opens the wallet dialog on this account (name, copy, source, the other
// accounts the wallet shared, Disconnect).
function AddressChip({ address }: { address: string }) {
  const { openWalletModal } = useAccount();
  return (
    <button type="button" className="address-chip" onClick={openWalletModal}>
      <IconWallet size={14} />
      <bdi dir="ltr" title={address}>{shortAddress(address)}</bdi>
    </button>
  );
}

// One activity row: who and when under a short plain title, the amount at the end.
// A failed transfer moved nothing, so it never reads as sent or received.
function ActivityRow({ a, now }: { a: Activity; now: number }) {
  const { t, i18n } = useTranslation();
  const known = !!a.counterparty && a.direction !== 'other';
  const title = !a.ok ? t('account.failed') : !known ? t('account.ok') : t(a.direction === 'sent' ? 'account.sentShort' : 'account.receivedShort');
  const sign = a.ok && known ? (a.direction === 'sent' ? '−' : '+') : '';
  return (
    <li>
      <Link className={`row${a.ok ? '' : ' row-failed'}`} to={`/account/activity/${encodeURIComponent(a.id)}`} state={a}>
        <ActivityChip a={a} />
        <span className="row-main">
          <span className="row-title">{title}</span>
          <span className="row-sub">
            {known && <>{!a.ok && <>{t(a.direction === 'received' ? 'account.from' : 'account.to')} </>}<Addr value={a.counterparty!} /> · </>}
            {relativeTime(a.when, now, i18n.language, t)}
          </span>
        </span>
        {/* Left to right in every locale, so the sign stays in front of the figure. */}
        <span dir="ltr" className={`row-amount${!a.ok ? ' muted' : a.direction === 'received' ? ' in' : ''}`}>
          {sign && <span aria-hidden="true">{sign}</span>}<ActivityAmount a={a} />
        </span>
      </Link>
    </li>
  );
}

// Newest first, as loaded; consecutive rows of one calendar day sit under one header.
function byDay(list: Activity[]): Activity[][] {
  const out: Activity[][] = [];
  for (const a of list) {
    const last = out[out.length - 1];
    if (last && dayKey(last[0].when) === dayKey(a.when)) last.push(a);
    else out.push([a]);
  }
  return out;
}

export default function Account() {
  const { t, i18n } = useTranslation();
  const { address, forget } = useAccount();
  // Signing out leaves for home, not for the open-account screen a missing account otherwise redirects to.
  const [signedOut, setSignedOut] = useState(false);
  const signOut = () => { setSignedOut(true); forget(); };
  // No account: the redirect below renders; nothing is fetched for a null address.
  const balances = useAsync(() => (address ? loadBalances(address) : Promise.resolve([])), [address]);
  const [hist, setHist] = useState<Hist>({ status: 'loading' });
  const [now, refreshNow] = useNow();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!address) return;
    let live = true;
    setHist({ status: 'loading' });
    loadActivity(address).then(
      (data) => { if (live) { refreshNow(); setHist({ status: 'ok', data }); } },
      (e) => live && setHist({ status: e instanceof NotIndexedError ? 'preparing' : 'error' }),
    );
    return () => { live = false; };
  }, [address, tick, refreshNow]);
  if (!address) return <Navigate to={signedOut ? '/' : '/account/open'} replace />;
  return (
    <>
      <PageHeader title={t('home.account')} />
      <div className="screen account">
        <Card className="total-card" title={t('account.total')} status={balances.status} onRetry={balances.retry}>
          {balances.data && <HoldingsTotal holdings={balances.data} />}
          <AddressChip address={address} />
        </Card>
        {/* The address stays at hand while the total is loading or failed. */}
        {balances.status !== 'ok' && <AddressChip address={address} />}
        {balances.status === 'ok' && balances.data && balances.data.length > 0 && <HoldingsTokens holdings={balances.data} />}
        <Card className="activity" title={t('account.activity')} status={hist.status} onRetry={() => setTick((n) => n + 1)}>
          {/* One or the other: the empty sentence, or a list with at least one row. */}
          {!hist.data || hist.data.length === 0 ? <p className="card-note">{t('account.empty')}</p> : byDay(hist.data).map((day) => (
            <div key={dayKey(day[0].when)} className="activity-day">
              <h3 className="day">{dayLabel(day[0].when, now, i18n.language, t)}</h3>
              <ul className="rows timeline">{day.map((a) => <ActivityRow key={a.id} a={a} now={now} />)}</ul>
            </div>
          ))}
        </Card>
        <button type="button" className="btn btn-quiet signout" onClick={signOut}>{t('app.signOut')}</button>
      </div>
    </>
  );
}

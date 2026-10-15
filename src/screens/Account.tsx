import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadBalances } from '../data/balances';
import { loadActivity, NotIndexedError, type Activity } from '../data/history';
import { Card } from '../ui/Card';
import { Addr, Amount } from '../ui/Layout';
import { ActivityAmount } from '../ui/ActivityAmount';
import { relativeTime } from '../lib/format';
import { useNow } from '../hooks/useNow';

type Hist = { status: 'loading' | 'ok' | 'error' | 'preparing'; data?: Activity[] };

export default function Account() {
  const { t, i18n } = useTranslation();
  const { address, forget } = useAccount();
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
  if (!address) return <Navigate to="/account/open" replace />;
  return (
    <div className="stack">
      <p className="who"><Addr value={address} /></p>
      <Card title={t('account.total')} status={balances.status} onRetry={balances.retry}>
        <ul className="holdings">
          {balances.data?.map((h) => <li key={h.symbol}><Amount value={h.amount} decimals={h.decimals} symbol={h.symbol} /></li>)}
        </ul>
      </Card>
      <Card title={t('account.activity')} status={hist.status} onRetry={() => setTick((n) => n + 1)}>
        {/* One or the other: the empty sentence, or a list with at least one row. */}
        {!hist.data || hist.data.length === 0 ? <p>{t('account.empty')}</p> : <ul className="timeline">
          {hist.data?.map((a) => (
            <li key={a.id}>
              <Link to={`/account/activity/${encodeURIComponent(a.id)}`} state={a}>
                {a.direction === 'other' || !a.counterparty || !a.ok ? (
                  <><ActivityAmount a={a} />{!a.ok && <> · {t('account.failed')}</>}</>
                ) : (
                  <Trans i18nKey={a.direction === 'sent' ? 'account.sent' : 'account.received'}
                    components={{ amount: <ActivityAmount a={a} />, who: <Addr value={a.counterparty} /> }} />
                )}
                {' · '}{relativeTime(a.when, now, i18n.language, t)} {a.ok ? '✅' : '❌'}
              </Link>
            </li>
          ))}
        </ul>}
      </Card>
      <button className="quiet" onClick={forget}>{t('account.forget')}</button>
    </div>
  );
}

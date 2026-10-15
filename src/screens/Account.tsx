import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadBalances, type Holding } from '../data/balances';
import { loadActivity, NotIndexedError, type Activity } from '../data/history';
import { Card } from '../ui/Card';
import { Addr } from '../ui/Layout';
import PageHeader from '../ui/PageHeader';
import { ActivityAmount } from '../ui/ActivityAmount';
import { ActivityChip } from '../ui/ActivityChip';
import { BigAmount } from '../ui/BigAmount';
import { ChainIcon, TokenIcon } from '../ui/assetIcons';
import { IconCheck, IconCopy } from '../ui/icons';
import { dayKey, dayLabel, formatNumber, relativeTime } from '../lib/format';
import { useNow } from '../hooks/useNow';
import { shortAddress } from '../lib/address';
import type { ChainKey } from '../config/network';
import './Account.css';

type Hist = { status: 'loading' | 'ok' | 'error' | 'preparing'; data?: Activity[] };
const CHAINS: ChainKey[] = ['relay', 'assetHub', 'people'];

// Copies the address. The chip says Copied (or Could not copy) for two seconds; each copy changes the live
// region's text (an invisible mark alternates), so a second copy is announced again.
const NOTE_MS = 2000;
function CopyAddress({ address }: { address: string }) {
  const { t } = useTranslation();
  const [note, setNote] = useState<'copied' | 'copyFailed' | null>(null);
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (n: 'copied' | 'copyFailed') => {
    clearTimeout(timer.current);
    setNote(n);
    setCount((c) => c + 1);
    timer.current = setTimeout(() => setNote(null), NOTE_MS);
  };
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(address);
      show('copied');
    } catch { show('copyFailed'); }
  };
  return (
    <>
      <button type="button" className={`copy-chip${note === 'copyFailed' ? ' copy-failed' : ''}`} onClick={() => void copy()}>
        <span className="sr-only">{t('account.copy')}: </span>
        {note ? <span aria-hidden="true">{t(`account.${note}`)}</span> : <bdi dir="ltr" title={address}>{shortAddress(address)}</bdi>}
        {note === 'copied' ? <IconCheck size={14} /> : <IconCopy size={14} />}
      </button>
      <span className="sr-only" role="status">{note ? t(`account.${note}`) + (count % 2 ? '\u200B' : '') : ''}</span>
    </>
  );
}

function Totals({ holdings }: { holdings: Holding[] }) {
  const { t, i18n } = useTranslation();
  const native = holdings[0];
  if (!native) return null;
  return (
    <>
      <BigAmount className="total-amount" value={native.amount} decimals={native.decimals} symbol={native.symbol} />
      {native.perChain && <ul className="chains">{CHAINS.map((c) => (
        <li key={c} className="chain-tile">
          <ChainIcon chain={c} />
          <span className="chain-name">{t(`chain.${c}`)}</span>
          <bdi className="chain-amount">{formatNumber(native.perChain![c], native.decimals, i18n.language)}</bdi>
        </li>))}</ul>}
    </>
  );
}

function Tokens({ holdings }: { holdings: Holding[] }) {
  const { t, i18n } = useTranslation();
  return (
    <section className="tokens" aria-label={t('account.tokens')}>
      <ul>{holdings.map((h, i) => (
        <li key={h.symbol} className="token-row">
          <TokenIcon symbol={h.symbol} />
          <span className="token-name"><span className="token-symbol">{h.symbol}</span><span className="token-chain">{i === 0 ? 'PezkuwiChain' : t('chain.assetHub')}</span></span>
          <bdi className="token-amount">{formatNumber(h.amount, h.decimals, i18n.language)}</bdi>
        </li>))}</ul>
    </section>
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
    <>
      <PageHeader title={t('home.account')} />
      <div className="screen account">
        <Card className="total-card" title={t('account.total')} status={balances.status} onRetry={balances.retry}>
          {balances.data && <Totals holdings={balances.data} />}
          <CopyAddress address={address} />
        </Card>
        {/* The address stays copyable while the total is loading or failed. */}
        {balances.status !== 'ok' && <CopyAddress address={address} />}
        {balances.status === 'ok' && balances.data && balances.data.length > 0 && <Tokens holdings={balances.data} />}
        <Card className="activity" title={t('account.activity')} status={hist.status} onRetry={() => setTick((n) => n + 1)}>
          {/* One or the other: the empty sentence, or a list with at least one row. */}
          {!hist.data || hist.data.length === 0 ? <p className="card-note">{t('account.empty')}</p> : byDay(hist.data).map((day) => (
            <div key={dayKey(day[0].when)} className="activity-day">
              <h3 className="day">{dayLabel(day[0].when, now, i18n.language, t)}</h3>
              <ul className="rows timeline">{day.map((a) => <ActivityRow key={a.id} a={a} now={now} />)}</ul>
            </div>
          ))}
        </Card>
        <button type="button" className="btn btn-text" onClick={forget}>{t('account.forget')}</button>
      </div>
    </>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { findPayment, indexerLag, InvalidLookupError, NotIndexedError, RECENT_LIMIT, type Activity, type PaymentLookup } from '../data/history';
import { scanQr } from '../account/connectors/qr';
import { Addr } from '../ui/Layout';
import { ActivityAmount } from '../ui/ActivityAmount';
import { NETWORK } from '../config/network';
import { relativeTime } from '../lib/format';
import { useNow } from '../hooks/useNow';
import PageHeader from '../ui/PageHeader';
import { ActivityChip } from '../ui/ActivityChip';
import { TokenIcon } from '../ui/assetIcons';
import { IconCheck, IconClock, IconCross, IconScan } from '../ui/icons';
import { Amount } from '../ui/Layout';
import './PaymentStatus.css';

type Simple = 'onTheWay' | 'notFound' | 'preparing' | 'error' | 'invalid' | 'noCamera';
type Found = Exclude<PaymentLookup, { status: 'notFound' }>;
type Answer = { r: Simple } | { r: 'found'; p: Found };

// One transfer in a list: what moved, between whom, when, and (chip) whether it went through.
// A failed transfer moved nothing, so it never reads as "sent X to Y": amount, Failed, the counterparty, time.
function TransferRow({ a, view, now }: { a: Activity; view: 'code' | 'address'; now: number }) {
  const { t, i18n } = useTranslation();
  const amount = <ActivityAmount a={a} />;
  const known = !!a.counterparty && a.direction !== 'other';
  let title;
  if (!a.ok) title = <>{amount} · {t('account.failed')}</>;
  else if (known) {
    // A code is always read from the sender's side ("X to Y"); an address row is relative to the queried address.
    const key = view === 'code' ? 'payment.to' : a.direction === 'sent' ? 'payment.sent' : 'payment.received';
    title = <Trans i18nKey={key} components={{ amount, who: <Addr value={a.counterparty!} /> }} />;
  } else title = amount;
  return (
    <li className={`row${a.ok ? '' : ' row-failed'}`}>
      <ActivityChip a={a} />
      <span className="row-main">
        <span className="row-title">{title}</span>
        <span className="row-sub">
          {!a.ok && known && <>{t(a.direction === 'received' ? 'account.from' : 'account.to')} <Addr value={a.counterparty!} /> · </>}
          {relativeTime(a.when, now, i18n.language, t)}
        </span>
      </span>
    </li>
  );
}

// The one transfer behind a verdict, as a card of facts: amount, the other side, when, fee.
function TransferFacts({ a, now }: { a: Activity; now: number }) {
  const { t, i18n } = useTranslation();
  const known = !!a.counterparty && a.direction !== 'other';
  return (
    <ul className="facts-list"><li>
      <dl className="facts">
        <div className="fact fact-amount">
          <dt className="lead"><TokenIcon symbol={a.symbol} size={32} />{t('account.amount')}</dt>
          <dd><ActivityAmount a={a} />{!a.ok && <span className="status-failed"> · {t('account.failed')}</span>}</dd>
        </div>
        {known && <div className="fact"><dt>{t(a.direction === 'received' ? 'account.from' : 'account.to')}</dt><dd><Addr value={a.counterparty!} /></dd></div>}
        <div className="fact"><dt>{t('account.when')}</dt><dd>{relativeTime(a.when, now, i18n.language, t)}</dd></div>
        <div className="fact"><dt>{t('account.fee')}</dt><dd><Amount value={a.fee} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></dd></div>
      </dl>
    </li></ul>
  );
}

const Mark = ({ tone }: { tone: 'ok' | 'bad' | 'wait' }) => (
  <p className={`big-mark mark-${tone}`} aria-hidden="true">
    {tone === 'ok' ? <IconCheck stroke={2.4} /> : tone === 'bad' ? <IconCross stroke={2.4} /> : <IconClock />}
  </p>
);

function FoundAnswer({ p, now }: { p: Found; now: number }) {
  const { t } = useTranslation();
  const list = (view: 'code' | 'address', rows: Activity[]) => (
    <ul className="rows">{rows.map((a) => <TransferRow key={a.id} a={a} view={view} now={now} />)}</ul>
  );
  if (p.kind === 'address') {
    // No verdict: the newest transfer touching an address need not be the payment the person means.
    return (
      <>
        <p className="lead-text"><Trans i18nKey="payment.recent" components={{ who: <Addr value={p.address} /> }} /></p>
        {list('address', p.transfers.slice(0, RECENT_LIMIT))}
      </>
    );
  }
  switch (p.status) {
    case 'notAPayment': return <p className="lead-text">{t('payment.notAPayment')}</p>;
    case 'failedNotAPayment': return <p className="lead-text">{t('payment.failedNotAPayment')}</p>;
    // The list may be missing transfers: no verdict, and no claim about an address that is not in it.
    case 'incomplete': return <><p className="lead-text">{t('payment.more')}</p>{p.transfers.length > 0 && list('code', p.transfers)}</>;
    // Several transfers, at least one went through: who got what is in the list, and no "went through"
    // heading sits above a failed row. (None went through: the "did not arrive" verdict below is true for all.)
    case 'several': {
      const ok = p.transfers.filter((a) => a.ok), failed = p.transfers.filter((a) => !a.ok);
      return (
        <>
          <h2 className="list-heading">{t('payment.several')}</h2>
          <p className="lead-text">{t('payment.notYou')}</p>
          {list('code', ok)}
          {failed.length > 0 && <><p className="group">{t('payment.failedGroup')}</p>{list('code', failed)}</>}
        </>
      );
    }
  }
  const only = p.transfers.length === 1 ? p.transfers[0] : null;
  const arrived = p.status === 'arrived';
  return (
    <div className="verdict">
      <Mark tone={arrived ? 'ok' : 'bad'} />
      <h2 className="verdict-word">{t(arrived ? 'payment.arrived' : 'payment.notArrived')}</h2>
      {arrived && only?.counterparty && only.direction !== 'other' && <p className="verdict-text"><Trans i18nKey="payment.arrivedText" components={{ who: <Addr value={only.counterparty} /> }} /></p>}
      {p.status === 'failed' && <p className="verdict-text">{t('payment.notArrivedText')}</p>}
      {only ? <TransferFacts a={only} now={now} /> : p.transfers.length > 0 && list('code', p.transfers)}
    </div>
  );
}

// The background glow follows the answer: green for arrived, red for did not arrive, gold while on its way.
const tone = (res: Answer | null) =>
  !res ? '' : res.r === 'onTheWay' ? ' glow-wait' : res.r !== 'found' ? '' : res.p.status === 'arrived' ? ' glow-ok' : res.p.status === 'failed' ? ' glow-bad' : '';
const centred = (res: Answer) => res.r !== 'found' || res.p.status === 'arrived' || res.p.status === 'failed';

export default function PaymentStatus() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [res, setRes] = useState<Answer | null>(null);
  const [now, refreshNow] = useNow();
  const latest = useRef(0);
  useEffect(() => () => { latest.current = -1; }, []);

  const run = async (text: string) => {
    const id = ++latest.current;
    const live = () => latest.current === id;
    setBusy(true); setRes(null);
    try {
      const p = await findPayment(text);
      if (!live()) return;
      if (p.status === 'notFound') {
        // An unreadable lag must not be reported as "on its way".
        const lag = await indexerLag().catch(() => 0);
        if (live()) setRes({ r: lag > 20 ? 'onTheWay' : 'notFound' });
      } else { refreshNow(); setRes({ r: 'found', p }); }
    } catch (err) {
      if (!live()) return;
      setRes({ r: err instanceof NotIndexedError ? 'preparing' : err instanceof InvalidLookupError ? 'invalid' : 'error' });
    } finally { if (live()) setBusy(false); }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void run(q); };

  // The scan lives and dies with scan mode; scanQr's finally block releases the camera on abort.
  useEffect(() => {
    if (!scanning || !video) return;
    const ctl = new AbortController();
    scanQr(video, ctl.signal)
      .then((text) => { if (ctl.signal.aborted) return; setScanning(false); setQ(text); void run(text); })
      .catch(() => { if (ctl.signal.aborted) return; setScanning(false); setRes({ r: 'noCamera' }); });
    return () => ctl.abort();
    // run only closes over refs and stable setters; restarting on its identity would reopen the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, video]);

  // Without an indexer no lookup can succeed: say so up front instead of offering a form that can only fail.
  if (!NETWORK.history.assetHub) {
    return (
      <>
        <PageHeader title={t('payment.title')} />
        <div className="screen payment">
          <div className="answer answer-preparing" role="status"><p className="lead-text">{t('state.preparing')}</p></div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('payment.title')} />
      <div className={`screen payment${tone(res)}`}>
        <form role="search" className="search" onSubmit={submit}>
          <div className="search-row">
            <input className="field" dir="ltr" enterKeyHint="search" autoComplete="off" spellCheck={false} aria-label={t('payment.placeholder')}
              value={q} onChange={(e) => { latest.current++; setBusy(false); setRes(null); setQ(e.target.value); }} placeholder={t('payment.placeholder')} />
            {!scanning && <button type="button" className="scan-button" aria-label={t('open.scan')}
              onClick={() => { latest.current++; setBusy(false); setRes(null); setScanning(true); }}><IconScan size={22} /></button>}
          </div>
          {!res && !scanning && <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? t('state.loading') : t('open.go')}</button>}
        </form>
        {scanning && <>
          <video ref={setVideo} playsInline muted className="scanner" />
          <button type="button" className="btn btn-quiet" onClick={() => setScanning(false)}>{t('app.back')}</button>
        </>}
        {res && <div className={`answer answer-${res.r === 'found' ? res.p.status : res.r}${centred(res) ? ' answer-centred' : ''}`} role="status">
          {res.r === 'found' && <FoundAnswer p={res.p} now={now} />}
          {res.r === 'onTheWay' && <div className="verdict"><Mark tone="wait" /><h2 className="verdict-word">{t('payment.onTheWay')}</h2></div>}
          {res.r === 'notFound' && <p className="lead-text">{t('payment.notFound')}</p>}
          {res.r === 'preparing' && <p className="lead-text">{t('state.preparing')}</p>}
          {res.r === 'invalid' && <p role="alert" className="alert">{t('open.invalid')}</p>}
          {res.r === 'noCamera' && <p role="alert" className="alert">{t('open.noCamera')}</p>}
          {res.r === 'error' && <p className="lead-text">{t('state.error')}</p>}
        </div>}
        {res && <Link className="btn btn-primary" to="/account">{t('home.account')}</Link>}
      </div>
    </>
  );
}

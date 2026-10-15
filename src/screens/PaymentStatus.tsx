import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { findPayment, indexerLag, InvalidLookupError, NotIndexedError, RECENT_LIMIT, type Activity, type PaymentLookup } from '../data/history';
import { scanQr } from '../account/connectors/qr';
import { Addr } from '../ui/Layout';
import { ActivityAmount } from '../ui/ActivityAmount';
import { NETWORK } from '../config/network';
import { relativeTime } from '../lib/format';
import { useNow } from '../hooks/useNow';

type Simple = 'onTheWay' | 'notFound' | 'preparing' | 'error' | 'invalid' | 'noCamera';
type Found = Exclude<PaymentLookup, { status: 'notFound' }>;
type Answer = { r: Simple } | { r: 'found'; p: Found };

const MARK = { arrived: '✅', failed: '❌', partial: '⚠️' } as const;
const HEADING = { arrived: 'payment.arrived', failed: 'payment.notArrived', partial: 'payment.partial' } as const;

// One transfer: what moved, between whom, when, and whether it went through.
function TransferRow({ a, view, now, mark }: { a: Activity; view: 'code' | 'address'; now: number; mark: boolean }) {
  const { t, i18n } = useTranslation();
  const amount = <ActivityAmount a={a} />;
  // A code is always read from the sender's side ("X to Y"); an address row is relative to the queried address.
  const key = !a.counterparty || a.direction === 'other' ? null
    : view === 'code' ? 'payment.to' : a.direction === 'sent' ? 'payment.sent' : 'payment.received';
  return (
    <li>
      {key ? <Trans i18nKey={key} components={{ amount, who: <Addr value={a.counterparty!} /> }} /> : amount}
      {' · '}{relativeTime(a.when, now, i18n.language, t)}
      {mark && <> <span role="img" aria-label={t(a.ok ? 'account.ok' : 'account.failed')}>{a.ok ? '✅' : '❌'}</span></>}
    </li>
  );
}

function FoundAnswer({ p, now }: { p: Found; now: number }) {
  const { t } = useTranslation();
  if (p.kind === 'address') {
    // No verdict: the newest transfer touching an address need not be the payment the person means.
    return (
      <>
        <p><Trans i18nKey="payment.recent" components={{ who: <Addr value={p.address} /> }} /></p>
        <ul className="payments">
          {p.transfers.slice(0, RECENT_LIMIT).map((a) => <TransferRow key={a.id} a={a} view="address" now={now} mark />)}
        </ul>
      </>
    );
  }
  if (p.status === 'notAPayment') return <p>{t('payment.notAPayment')}</p>;
  const only = p.transfers.length === 1 ? p.transfers[0] : null;
  return (
    <>
      <p className="big-mark">{MARK[p.status]}</p>
      <h2>{t(HEADING[p.status])}</h2>
      {p.status === 'arrived' && only?.counterparty && <p><Trans i18nKey="payment.arrivedText" components={{ who: <Addr value={only.counterparty} /> }} /></p>}
      {p.status === 'failed' && <p>{t('payment.notArrivedText')}</p>}
      {p.status === 'partial' && <p>{t('payment.partialText')}</p>}
      {p.transfers.length > 0 && <ul className="payments">
        {p.transfers.map((a) => <TransferRow key={a.id} a={a} view="code" now={now} mark={p.transfers.length > 1} />)}
      </ul>}
    </>
  );
}

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
      <div className="stack">
        <h1>{t('payment.title')}</h1>
        <div className="answer answer-preparing" role="status"><p>{t('state.preparing')}</p></div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>{t('payment.title')}</h1>
      <form role="search" onSubmit={submit}>
        <textarea dir="ltr" rows={3} value={q} onChange={(e) => { latest.current++; setBusy(false); setRes(null); setQ(e.target.value); }} placeholder={t('payment.placeholder')} />
        <button className="big" type="submit" disabled={busy}>{busy ? t('state.loading') : t('open.go')}</button>
      </form>
      {scanning
        ? <>
            <video ref={setVideo} playsInline muted className="scanner" />
            <button className="big" onClick={() => setScanning(false)}>{t('app.back')}</button>
          </>
        : <button className="big" onClick={() => { latest.current++; setBusy(false); setRes(null); setScanning(true); }}>{t('open.scan')}</button>}
      {res && <div className={`answer answer-${res.r === 'found' ? res.p.status : res.r}`} role="status">
        {res.r === 'found' && <FoundAnswer p={res.p} now={now} />}
        {res.r === 'onTheWay' && <><p className="big-mark">⏳</p><h2>{t('payment.onTheWay')}</h2></>}
        {res.r === 'notFound' && <p>{t('payment.notFound')}</p>}
        {res.r === 'preparing' && <p>{t('state.preparing')}</p>}
        {res.r === 'invalid' && <p role="alert">{t('open.invalid')}</p>}
        {res.r === 'noCamera' && <p role="alert">{t('open.noCamera')}</p>}
        {res.r === 'error' && <p>{t('state.error')}</p>}
      </div>}
    </div>
  );
}

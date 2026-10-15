import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { findPayment, indexerLag, NotIndexedError } from '../data/history';
import { scanQr } from '../account/connectors/qr';
import { normaliseAddress } from '../lib/address';
import { Addr } from '../ui/Layout';

type Result = 'arrived' | 'failed' | 'onTheWay' | 'notFound' | 'notAPayment' | 'preparing' | 'error' | 'invalid' | 'noCamera';

export default function PaymentStatus() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [res, setRes] = useState<{ r: Result; who?: string | null } | null>(null);
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
      } else if (p.status === 'arrived') {
        const a = p.activity;
        // The sentence must be true for both views: a sender's lookup names the recipient; a lookup of a received payment names the queried address itself.
        const who = a?.direction === 'received' ? normaliseAddress(text.trim()) : (a?.counterparty ?? null);
        setRes({ r: 'arrived', who });
      } else setRes({ r: p.status });
    } catch (err) {
      if (!live()) return;
      setRes({ r: err instanceof NotIndexedError ? 'preparing' : err instanceof Error && err.message === 'not a code or address' ? 'invalid' : 'error' });
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

  return (
    <div className="stack">
      <h1>{t('payment.title')}</h1>
      <form role="search" onSubmit={submit}>
        <textarea dir="ltr" rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('payment.placeholder')} />
        <button className="big" type="submit" disabled={busy}>{busy ? t('state.loading') : t('open.go')}</button>
      </form>
      {scanning
        ? <>
            <video ref={setVideo} playsInline muted className="scanner" />
            <button className="big" onClick={() => setScanning(false)}>{t('app.back')}</button>
          </>
        : <button className="big" onClick={() => { setRes(null); setScanning(true); }}>{t('open.scan')}</button>}
      {res && <div className={`answer answer-${res.r}`} role="status">
        {res.r === 'arrived' && <><p className="big-mark">✅</p><h2>{t('payment.arrived')}</h2>{res.who && <p><Trans i18nKey="payment.arrivedText" components={{ who: <Addr value={res.who} /> }} /></p>}</>}
        {res.r === 'failed' && <><p className="big-mark">❌</p><h2>{t('payment.notArrived')}</h2><p>{t('payment.notArrivedText')}</p></>}
        {res.r === 'onTheWay' && <><p className="big-mark">⏳</p><h2>{t('payment.onTheWay')}</h2></>}
        {res.r === 'notFound' && <p>{t('payment.notFound')}</p>}
        {res.r === 'notAPayment' && <p>{t('payment.notAPayment')}</p>}
        {res.r === 'preparing' && <p>{t('state.preparing')}</p>}
        {res.r === 'invalid' && <p role="alert">{t('open.invalid')}</p>}
        {res.r === 'noCamera' && <p role="alert">{t('open.noCamera')}</p>}
        {res.r === 'error' && <p>{t('state.error')}</p>}
      </div>}
    </div>
  );
}

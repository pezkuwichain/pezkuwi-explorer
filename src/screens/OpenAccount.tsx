import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';
import { scanQr } from '../account/connectors/qr';
import PageHeader from '../ui/PageHeader';
import { IconPaste, IconScan, IconWallet } from '../ui/icons';
import './OpenAccount.css';

type Mode = 'menu' | 'paste' | 'scan';
const NEXT_PAGES = ['/account', '/citizenship', '/payment', '/network'] as const;
// The home card links straight into one way in (?way=paste|scan|wallet); anything else opens the menu.
const WAYS = ['paste', 'scan', 'wallet'] as const;

export default function OpenAccount() {
  const { t } = useTranslation();
  const { open, address, source, openWalletModal } = useAccount();
  const nav = useNavigate();
  // Only the app's own pages: anything else (another site, a protocol-relative URL) falls back to the account.
  const [params] = useSearchParams();
  const asked = params.get('next');
  const next = NEXT_PAGES.find((p) => p === asked) ?? '/account';
  const way = WAYS.find((w) => w === params.get('way'));
  const [mode, setMode] = useState<Mode>(way === 'paste' || way === 'scan' ? way : 'menu');
  const walletAsked = useRef(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  const finish = (a: string) => {
    if (open(a.trim())) nav(next, { replace: true });
    else setError(t('open.invalid'));
  };

  // The wallet way is the wallet dialog (account/WalletModal). Once it opens an account, go on to the next page;
  // the dialog stays over it showing the connected account until it is closed.
  const wallet = () => { setError(null); walletAsked.current = true; openWalletModal(); };
  useEffect(() => {
    if (walletAsked.current && address && source && source !== 'address') nav(next, { replace: true });
  }, [address, source, next, nav]);

  // Arriving with ?way=wallet opens the wallet dialog once (the ref survives StrictMode's effect replay).
  useEffect(() => {
    if (way !== 'wallet' || walletAsked.current) return;
    wallet();
    // wallet only closes over stable values for this one start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [way]);

  // The scan lives and dies with scan mode: leaving it (or unmounting) aborts the
  // loop, and scanQr's finally block releases the camera.
  useEffect(() => {
    if (mode !== 'scan' || !video) return;
    const ctl = new AbortController();
    scanQr(video, ctl.signal)
      .then((a) => { if (!ctl.signal.aborted) finish(a); })
      .catch(() => {
        if (ctl.signal.aborted) return;
        setMode('menu'); setError(t('open.noCamera'));
      });
    return () => ctl.abort();
    // finish only closes over stable values for one scan; restarting on its identity would reopen the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, video]);

  return (
    <>
      <PageHeader title={t('open.title')} />
      <div className="screen open">
        {mode === 'menu' && <div className="ways">
          <button type="button" className="way way-main" onClick={wallet}><span className="way-icon"><IconWallet /></span>{t('open.wallet')}</button>
          <button type="button" className="way" onClick={() => { setError(null); setMode('scan'); }}><span className="way-icon"><IconScan /></span>{t('open.scan')}</button>
          <button type="button" className="way" onClick={() => { setError(null); setMode('paste'); }}><span className="way-icon"><IconPaste /></span>{t('open.paste')}</button>
        </div>}
        {mode === 'paste' && <>
          <textarea className="field" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('open.pastePlaceholder')} rows={3} />
          <button type="button" className="btn btn-primary" onClick={() => finish(text)}>{t('open.go')}</button>
        </>}
        {mode === 'scan' && <video ref={setVideo} playsInline muted className="scanner" />}
        {mode === 'scan' && <button type="button" className="btn btn-quiet" onClick={() => { setError(null); setMode('menu'); }}>{t('app.back')}</button>}
        {error && <p role="alert" className="alert">{error}</p>}
      </div>
    </>
  );
}

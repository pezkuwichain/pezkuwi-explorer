import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount, type Source } from '../account/AccountContext';
import { extensionAccounts, NoWalletError, RejectedError } from '../account/connectors/extension';
import { walletConnectAccounts } from '../account/connectors/walletconnect';
import { scanQr } from '../account/connectors/qr';
import { followDeepLink, onPhone, PLAY_STORE, routes, type Route } from '../account/platform';
import { qrModules } from '../citizen/qr';
import PageHeader from '../ui/PageHeader';
import { IconPaste, IconScan, IconWallet } from '../ui/icons';
import './OpenAccount.css';

type Mode = 'menu' | 'paste' | 'scan' | 'pick' | 'wc';
const NEXT_PAGES = ['/account', '/citizenship', '/payment', '/network'] as const;
// The home card links straight into one way in (?way=paste|scan|wallet); anything else opens the menu.
const WAYS = ['paste', 'scan', 'wallet'] as const;
type Pairing = { uri: string; deepLink: string };

// The pairing as a QR for a wallet on another device: drawn on the device as an SVG path (the CSP allows no
// remote images), dark modules on a white quiet zone so any wallet camera reads it in either theme.
function PairingQr({ uri }: { uri: string }) {
  const qr = useMemo(() => qrModules(uri), [uri]);
  const pad = 4;
  const side = qr.size + pad * 2;
  return (
    <div className="wc-qr">
      <svg viewBox={`${-pad} ${-pad} ${side} ${side}`} width={232} height={232} role="img" aria-label="WalletConnect QR" shapeRendering="crispEdges">
        <rect x={-pad} y={-pad} width={side} height={side} fill="#FFFFFF" />
        <path fill="#04060E" d={qr.path} />
      </svg>
    </div>
  );
}

export default function OpenAccount() {
  const { t } = useTranslation();
  const { open } = useAccount();
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
  const [choices, setChoices] = useState<{ list: string[]; source: Source }>({ list: [], source: 'address' });
  const [pairing, setPairing] = useState<Pairing | null>(null);
  // The wallet ways this device has (see account/platform.ts); fixed for the life of the screen.
  const [ways] = useState<Route[]>(() => routes());
  const phone = useMemo(() => onPhone(), []);
  const wcCtl = useRef<AbortController | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  const finish = (a: string, source: Source = 'address') => {
    if (open(a.trim(), source)) nav(next, { replace: true });
    else setError(t('open.invalid'));
  };
  const pickFrom = (list: string[], source: Source) => {
    if (list.length === 0) setError(t('open.rejected'));
    else if (list.length === 1) finish(list[0], source);
    else { setChoices({ list, source }); setMode('pick'); }
  };

  // Whatever the page has injected: the Pezkuwi extension on a desktop, the wallet itself in its own browser.
  const extension = async () => {
    setError(null);
    try { pickFrom(await extensionAccounts(), 'extension'); }
    catch (e) { setError(t(e instanceof NoWalletError ? 'open.noWallet' : 'open.rejected')); }
  };

  // WalletConnect: a QR on a desktop, the deep link into Pezkuwi Wallet on a phone.
  const walletConnect = async () => {
    setError(null);
    wcCtl.current?.abort();
    const ctl = new AbortController();
    wcCtl.current = ctl;
    try {
      setMode('wc');
      const list = await walletConnectAccounts((p) => {
        // Only a WalletConnect pairing URI is ever shown or followed.
        if (ctl.signal.aborted || !p.uri.startsWith('wc:')) return;
        setPairing(p);
        if (phone) followDeepLink(p.deepLink);
      }, ctl.signal);
      if (ctl.signal.aborted) return;
      if (list.length === 0) { setMode('menu'); setPairing(null); }
      pickFrom(list, 'walletconnect');
    } catch (e) {
      if (ctl.signal.aborted) return;
      setMode('menu'); setPairing(null);
      setError(t(e instanceof RejectedError ? 'open.rejected' : 'open.noWallet'));
    }
  };
  const go = (r: Route) => (r === 'extension' ? extension() : walletConnect());
  const wallet = () => go(ways[0]);
  const back = () => { wcCtl.current?.abort(); setPairing(null); setError(null); setMode('menu'); };

  useEffect(() => () => wcCtl.current?.abort(), []);

  // Arriving with ?way=wallet starts the wallet flow once (the ref survives StrictMode's effect replay).
  useEffect(() => {
    if (way !== 'wallet' || walletAsked.current) return;
    walletAsked.current = true;
    void wallet();
    // wallet only closes over stable setters and refs for this one start.
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
          {ways.map((r, i) => (
            <button type="button" key={r} className={`way${i === 0 ? ' way-main' : ''}`} onClick={() => void go(r)}>
              <span className="way-icon">{r === 'wc-qr' ? <IconScan /> : <IconWallet />}</span>{t(r === 'wc-qr' ? 'open.otherDevice' : 'open.wallet')}
            </button>
          ))}
          <button type="button" className="way" onClick={() => { setError(null); setMode('scan'); }}><span className="way-icon"><IconScan /></span>{t('open.scan')}</button>
          <button type="button" className="way" onClick={() => { setError(null); setMode('paste'); }}><span className="way-icon"><IconPaste /></span>{t('open.paste')}</button>
        </div>}
        {mode === 'paste' && <>
          <textarea className="field" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('open.pastePlaceholder')} rows={3} />
          <button type="button" className="btn btn-primary" onClick={() => finish(text)}>{t('open.go')}</button>
        </>}
        {mode === 'scan' && <video ref={setVideo} playsInline muted className="scanner" />}
        {mode === 'wc' && pairing && (phone ? <>
          {/* The page has already followed this link; the button is for when the browser did not. */}
          <a className="btn btn-primary" href={pairing.deepLink}>{t('open.openApp')}</a>
          <p className="hint" role="status">{t('open.waiting')}</p>
          <p className="hint">{t('open.getApp')} <a className="store-link" href={PLAY_STORE} target="_blank" rel="noopener noreferrer">{t('open.onPlay')}</a></p>
        </> : <>
          <PairingQr uri={pairing.uri} />
          <p className="hint wc-note">{t('open.qrHow')}</p>
          <p className="hint wc-note" role="status">{t('open.waiting')}</p>
        </>)}
        {mode === 'pick' && <div className="ways">{choices.list.map((a) => <button type="button" key={a} className="way way-address" onClick={() => finish(a, choices.source)}><bdi dir="ltr">{a}</bdi></button>)}</div>}
        {(mode === 'scan' || mode === 'wc') && <button type="button" className="btn btn-quiet" onClick={back}>{t('app.back')}</button>}
        {error && <p role="alert" className="alert">{error}</p>}
      </div>
    </>
  );
}

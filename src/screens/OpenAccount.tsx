import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';
import { extensionAccounts, NoWalletError, RejectedError } from '../account/connectors/extension';
import { walletConnectAccounts } from '../account/connectors/walletconnect';
import { scanQr } from '../account/connectors/qr';

type Mode = 'menu' | 'paste' | 'scan' | 'pick' | 'wc';
const NEXT_PAGES = ['/account', '/citizenship', '/payment', '/network'] as const;

export default function OpenAccount() {
  const { t } = useTranslation();
  const { open } = useAccount();
  const nav = useNavigate();
  // Only the app's own pages: anything else (another site, a protocol-relative URL) falls back to the account.
  const asked = useSearchParams()[0].get('next');
  const next = NEXT_PAGES.find((p) => p === asked) ?? '/account';
  const [mode, setMode] = useState<Mode>('menu');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const wcCtl = useRef<AbortController | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  const finish = (a: string) => {
    if (open(a.trim())) nav(next, { replace: true });
    else setError(t('open.invalid'));
  };
  const pickFrom = (list: string[]) => {
    if (list.length === 0) setError(t('open.rejected'));
    else if (list.length === 1) finish(list[0]);
    else { setChoices(list); setMode('pick'); }
  };

  const wallet = async () => {
    setError(null);
    try { pickFrom(await extensionAccounts()); return; }
    catch (e) { if (!(e instanceof NoWalletError)) { setError(t('open.rejected')); return; } }
    wcCtl.current?.abort();
    const ctl = new AbortController();
    wcCtl.current = ctl;
    try {
      setMode('wc');
      const list = await walletConnectAccounts(setWcUri, ctl.signal);
      if (ctl.signal.aborted) return;
      if (list.length === 0) { setMode('menu'); setWcUri(null); }
      pickFrom(list);
    } catch (e) {
      if (ctl.signal.aborted) return;
      setMode('menu'); setWcUri(null);
      setError(t(e instanceof RejectedError ? 'open.rejected' : 'open.noWallet'));
    }
  };
  const back = () => { wcCtl.current?.abort(); setWcUri(null); setError(null); setMode('menu'); };

  useEffect(() => () => wcCtl.current?.abort(), []);

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
    <div className="stack">
      <h1>{t('open.title')}</h1>
      {mode === 'menu' && <>
        <button className="big" onClick={wallet}>{t('open.wallet')}</button>
        <button className="big" onClick={() => { setError(null); setMode('scan'); }}>{t('open.scan')}</button>
        <button className="big" onClick={() => { setError(null); setMode('paste'); }}>{t('open.paste')}</button>
      </>}
      {mode === 'paste' && <>
        <textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('open.pastePlaceholder')} rows={3} />
        <button className="big" onClick={() => finish(text)}>{t('open.go')}</button>
      </>}
      {mode === 'scan' && <video ref={setVideo} playsInline muted className="scanner" />}
      {mode === 'wc' && wcUri?.startsWith('wc:') && <>
        {/* The raw wc: URI is the scheme both wallet apps register for pairing. */}
        <a className="big button" href={wcUri}>{t('open.wallet')}</a>
        {/* Some wallets (iOS) do not register the wc: scheme, so the link can do nothing. */}
        <p>{t('open.wcHint')}</p>
        <bdi dir="ltr" className="wc-uri">{wcUri}</bdi>
      </>}
      {mode === 'pick' && choices.map((a) => <button key={a} className="big" onClick={() => finish(a)}><bdi dir="ltr">{a}</bdi></button>)}
      {(mode === 'scan' || mode === 'wc') && <button className="big" onClick={back}>{t('app.back')}</button>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import PageHeader from '../../ui/PageHeader';
import { IconCheck, IconCross, IconFaceId, IconScan, IconWarning } from '../../ui/icons';
import { scanQr } from '../../account/connectors/qr';
import { normaliseAddress, shortAddress } from '../../lib/address';
import { formatAmount } from '../../lib/format';
import { IWALLET_ED } from '../../config/iwallet-network';
import { getMainnetApi } from '../chain';
import { loadAssetBalances, loadHezBalance } from '../data';
import { hasFaceId, unlockWithFaceId } from '../faceid';
import { CorruptKeystoreError, WrongPasswordError, unlock as decrypt } from '../keystore';
import { useIWallet } from '../IWalletContext';
import { parseAmount } from '../amount';
import {
  LARGE_HEZ, SEND_TOKENS, buildTransfer, estimateFee, friendlyError, maxSendable, needsLargeAck, submit, tokenInfo,
  type SendToken, type SubmitEvent,
} from '../tx';
import CopyAddress from '../CopyAddress';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

const FEE_DEBOUNCE_MS = 400;
type Phase = 'form' | 'confirm' | 'result';
type Outcome =
  | { kind: 'pending' }
  | { kind: 'inBlock' }
  | { kind: 'finalized'; hash: string; block: number | null }
  | { kind: 'failed'; message: string }
  | { kind: 'interrupted' };
type Balances = { hez: bigint | null; assets: Record<number, bigint> } | 'failed' | null;

function SendBody({ address }: { address: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const nav = useNavigate();
  const { keystore } = useIWallet();

  const [phase, setPhase] = useState<Phase>('form');
  const [to, setTo] = useState('');
  const [token, setToken] = useState<SendToken>('HEZ');
  const [amountText, setAmountText] = useState('');
  const [ack, setAck] = useState(false);
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [balances, setBalances] = useState<Balances>(null);
  const [feeResult, setFeeResult] = useState<{ key: string; fee: bigint | null } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [scanError, setScanError] = useState(false);
  const [face, setFace] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending' });
  const busyRef = useRef(false);

  const info = tokenInfo(token);
  const toNorm = useMemo(() => normaliseAddress(to), [to]);
  const amount = useMemo(() => parseAmount(amountText, info.decimals), [amountText, info.decimals]);

  // The mainnet Asset Hub connection and the balances, loaded once.
  useEffect(() => {
    let live = true;
    getMainnetApi('assetHub').then((a) => { if (live) setApi(a); }, () => undefined);
    Promise.all([loadHezBalance(address), loadAssetBalances(address)]).then(
      ([h, a]) => {
        if (!live) return;
        setBalances({ hez: h.assetHubSpendable, assets: Object.fromEntries(a.map((x) => [x.id, x.amount])) });
      },
      () => { if (live) setBalances('failed'); },
    );
    hasFaceId().then((v) => { if (live) setFace(v); }, () => undefined);
    return () => { live = false; };
  }, [address]);

  const hezSpendable = balances && balances !== 'failed' ? balances.hez : null;
  const balance = balances && balances !== 'failed'
    ? (info.assetId === null ? balances.hez : (balances.assets[info.assetId] ?? 0n))
    : null;

  // The fee comes from paymentInfo on the call as it would be sent (a unit amount until one is typed), debounced.
  const feeAmount = amount !== null && amount > 0n ? amount : 1n;
  const feeTo = toNorm ?? address;
  const feeKey = `${token}|${feeTo}|${feeAmount}`;
  const fee = api && feeResult?.key === feeKey ? feeResult.fee : null;
  useEffect(() => {
    if (!api) return;
    let live = true;
    const timer = setTimeout(() => {
      let tx;
      try { tx = buildTransfer(api, token, feeTo, feeAmount); } catch { return; }
      void estimateFee(tx, address).then((f) => { if (live) setFeeResult({ key: feeKey, fee: f }); });
    }, FEE_DEBOUNCE_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [api, token, feeTo, feeAmount, feeKey, address]);

  // Scanning lives and dies with scan mode; scanQr releases the camera when it ends.
  useEffect(() => {
    if (!scanning || !video) return;
    const ctl = new AbortController();
    scanQr(video, ctl.signal)
      .then((a) => { if (!ctl.signal.aborted) { setTo(a); setScanning(false); } })
      .catch(() => { if (!ctl.signal.aborted) { setScanning(false); setScanError(true); } });
    return () => ctl.abort();
  }, [scanning, video]);

  const maxAmount = balance === null ? null
    : maxSendable(balance, info.assetId === null ? (fee ?? 0n) : 0n, IWALLET_ED.assetHub, token);
  const large = needsLargeAck(token, amount);
  const noFee = info.assetId !== null && fee !== null && hezSpendable !== null && hezSpendable < fee;
  const exceeds = amount !== null && maxAmount !== null && amount > maxAmount;

  const addressError = to.trim() !== '' && toNorm === null;
  const isSelf = toNorm !== null && toNorm === normaliseAddress(address);
  let amountError: string | null = null;
  if (amountText.trim() !== '' && amount === null) {
    amountError = /^\d*[.,]\d+$/.test(amountText.trim()) ? t('iwallet.send.decimals', { symbol: info.symbol, n: info.decimals }) : t('iwallet.send.amountInvalid');
  } else if (exceeds) amountError = t('iwallet.send.exceeds');

  const canReview = toNorm !== null && amount !== null && amount > 0n && balance !== null && !exceeds && !noFee && (!large || ack) && !busy;
  const money = (v: bigint, tk: SendToken = token) => formatAmount(v, tokenInfo(tk).decimals, tk, lang);

  const review = (e: FormEvent) => { e.preventDefault(); if (canReview) { setAuthError(null); setPhase('confirm'); } };

  // Decrypts a fresh pair for this one transfer, signs, and locks it again whatever happens.
  const send = async (password: string) => {
    if (busyRef.current || !api || !keystore || toNorm === null || amount === null) return;
    busyRef.current = true; setBusy(true); setAuthError(null);
    let pair;
    try {
      pair = await decrypt(keystore, password);
    } catch (err) {
      setAuthError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
      busyRef.current = false; setBusy(false);
      return;
    }
    setPw('');
    setOutcome({ kind: 'pending' }); setPhase('result');
    let terminal = false;
    let submitted = false;
    const onDisconnect = () => { if (!terminal && submitted) setOutcome({ kind: 'interrupted' }); };
    api.on('disconnected', onDisconnect);
    const onStatus = (ev: SubmitEvent) => {
      if (ev.type === 'submitted') submitted = true;
      else if (ev.type === 'inBlock') setOutcome({ kind: 'inBlock' });
      else if (ev.type === 'finalized') {
        terminal = true;
        setOutcome({ kind: 'finalized', hash: ev.extrinsicHash, block: null });
        void api.rpc.chain.getHeader(ev.blockHash).then(
          (h) => setOutcome((o) => (o.kind === 'finalized' ? { ...o, block: h.number.toNumber() } : o)),
          () => undefined,
        );
      } else if (ev.type === 'failed') {
        terminal = true; setOutcome({ kind: 'failed', message: friendlyError(api, ev.dispatchError, t) });
      } else if (ev.type === 'dropped') {
        terminal = true; setOutcome({ kind: 'failed', message: t('iwallet.send.dropped') });
      }
    };
    try {
      await submit(buildTransfer(api, token, toNorm, amount), pair, onStatus);
    } catch {
      // After the transaction left this device the outcome is unknown; before that the node refused it.
      terminal = true;
      setOutcome(submitted ? { kind: 'interrupted' } : { kind: 'failed', message: t('iwallet.error.generic') });
    } finally {
      try { pair.lock(); } catch { /* already locked */ }
      api.off('disconnected', onDisconnect);
      busyRef.current = false; setBusy(false);
    }
  };

  const confirmWithPassword = (e: FormEvent) => { e.preventDefault(); if (pw && !busy) void send(pw); };
  const confirmWithFace = async () => {
    if (busy) return;
    setAuthError(null);
    const p = await unlockWithFaceId();
    if (p === null) { setAuthError(t('iwallet.send.faceFailed')); return; }
    await send(p);
  };

  const reset = () => {
    setPhase('form'); setTo(''); setAmountText(''); setAck(false); setPw(''); setAuthError(null); setOutcome({ kind: 'pending' });
  };

  if (phase === 'result') {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.send.title', { token })} />
        <div className="iw-body iw-result" aria-live="polite">
          {outcome.kind === 'pending' && <p className="iw-lead" role="status">{t('iwallet.send.pending')}</p>}
          {outcome.kind === 'inBlock' && <p className="iw-lead" role="status">{t('iwallet.send.inBlock')}</p>}
          {outcome.kind === 'finalized' && <>
            <span className="iw-result-icon"><IconCheck size={32} /></span>
            <h2 className="iw-h1">{t('iwallet.send.doneTitle')}</h2>
            <p className="iw-lead">{amount !== null ? money(amount) : ''} → <bdi dir="ltr">{shortAddress(toNorm ?? '')}</bdi></p>
            {outcome.block !== null && <p className="iw-lead">{t('iwallet.send.recordNo')}: <bdi dir="ltr">{outcome.block}</bdi></p>}
            <p className="iw-lead">{t('iwallet.send.txId')}</p>
            <div className="iw-addr iw-addr-full">
              <bdi dir="ltr" className="iw-addr-text">{outcome.hash}</bdi>
              <CopyAddress address={outcome.hash} label={t('iwallet.send.copyTxId')} />
            </div>
          </>}
          {outcome.kind === 'failed' && <>
            <span className="iw-result-icon bad"><IconCross size={32} /></span>
            <h2 className="iw-h1">{t('iwallet.send.failedTitle')}</h2>
            <p className="iw-error" role="alert">{outcome.message}</p>
          </>}
          {outcome.kind === 'interrupted' && <p className="iw-note" role="alert">{t('iwallet.send.interrupted')}</p>}
          {outcome.kind !== 'pending' && outcome.kind !== 'inBlock' && <>
            <button type="button" className="iw-primary" onClick={() => nav('/i-wallet')}>{t('iwallet.send.done')}</button>
            <button type="button" className="iw-secondary" onClick={reset}>{t('iwallet.send.another')}</button>
          </>}
        </div>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.send.confirmTitle')} />
        <form className="iw-body iw-form" onSubmit={confirmWithPassword}>
          <dl className="iw-summary">
            <dt>{t('iwallet.send.to')}</dt><dd><bdi dir="ltr">{toNorm}</bdi></dd>
            <dt>{t('iwallet.send.amount')}</dt><dd><bdi dir="ltr">{amount !== null ? money(amount) : ''}</bdi></dd>
            <dt>{t('iwallet.send.feeLabel')}</dt>
            <dd><bdi dir="ltr">{fee !== null ? money(fee, 'HEZ') : '—'}</bdi></dd>
          </dl>
          <label className="iw-field">
            <span>{t('iwallet.password.label')}</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" disabled={busy} />
          </label>
          {authError && <p className="iw-error" role="alert">{authError}</p>}
          <button type="submit" className="iw-primary" disabled={!pw || busy}>{t(busy ? 'iwallet.send.working' : 'iwallet.send.confirm')}</button>
          {face && (
            <button type="button" className="iw-secondary" disabled={busy} onClick={() => void confirmWithFace()}>
              <IconFaceId size={20} /> {t('iwallet.faceid.title')}
            </button>
          )}
          <button type="button" className="iw-secondary" disabled={busy} onClick={() => { setPhase('form'); setPw(''); setAuthError(null); }}>{t('app.back')}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.send.title', { token })} />
      <form className="iw-body iw-form" onSubmit={review}>
        <div className="iw-field">
          <span>{t('iwallet.send.token')}</span>
          <div className="iw-tokens" role="group" aria-label={t('iwallet.send.token')}>
            {SEND_TOKENS.map((tk) => (
              <button key={tk} type="button" className="iw-token" aria-pressed={tk === token} onClick={() => { setToken(tk); setAck(false); }}>{tk}</button>
            ))}
          </div>
        </div>

        <div className="iw-field">
          <label htmlFor="iw-send-to">{t('iwallet.send.recipient')}</label>
          <span className="iw-row">
            <input id="iw-send-to" type="text" dir="ltr" value={to} onChange={(e) => { setTo(e.target.value); setScanError(false); }} spellCheck={false} autoComplete="off" />
            <button type="button" className="iw-square" aria-label={t('iwallet.send.scan')} onClick={() => { setScanError(false); setScanning(true); }}><IconScan size={22} /></button>
          </span>
        </div>
        {scanning && <>
          <video ref={setVideo} playsInline muted className="iw-scan" />
          <button type="button" className="iw-secondary" onClick={() => setScanning(false)}>{t('app.back')}</button>
        </>}
        {scanError && <p className="iw-error" role="alert">{t('open.noCamera')}</p>}
        {addressError && <p className="iw-error" role="alert">{t('iwallet.send.invalid')}</p>}
        {isSelf && <p className="iw-note" role="status">{t('iwallet.send.self')}</p>}

        <div className="iw-field">
          <label htmlFor="iw-send-amount">{t('iwallet.send.amount')}</label>
          <span className={`iw-amount-box${large ? ' big' : ''}`}>
            <input id="iw-send-amount" type="text" inputMode="decimal" dir="ltr" value={amountText} placeholder="0" autoComplete="off"
              onChange={(e) => { setAmountText(e.target.value); setAck(false); }} />
            <span className="sym">{token}</span>
            <button type="button" className="iw-max" disabled={maxAmount === null || (info.assetId === null && fee === null)}
              onClick={() => {
                if (maxAmount === null) return;
                const s = maxAmount.toString().padStart(info.decimals + 1, '0');
                const whole = s.slice(0, s.length - info.decimals);
                const frac = s.slice(s.length - info.decimals).replace(/0+$/, '');
                setAmountText(frac ? `${whole}.${frac}` : whole); setAck(false);
              }}>{t('iwallet.send.max')}</button>
          </span>
        </div>
        {amountError && <p className="iw-error" role="alert">{amountError}</p>}
        <div className="iw-meta">
          <span>{balances === 'failed' ? t('iwallet.send.balanceFailed') : t('iwallet.send.available', { amount: balance === null ? '—' : money(balance) })}</span>
          <span>{fee === null ? t('iwallet.send.feeUnknown') : t('iwallet.send.fee', { fee: money(fee, 'HEZ') })}</span>
        </div>
        {noFee && <p className="iw-error" role="alert">{t('iwallet.send.noFee')}</p>}

        {large && (
          <div className="iw-fire" role="alert">
            <IconWarning size={18} />
            <div className="iw-warning-text">
              <span><strong>{t('iwallet.send.largeTitle')}</strong> {t('iwallet.send.largeBody', { limit: (LARGE_HEZ / 10n ** 12n).toString() })}</span>
              <label className="iw-check">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                {t('iwallet.send.largeAck')}
              </label>
            </div>
          </div>
        )}

        <button type="submit" className="iw-primary" disabled={!canReview}>
          <IconFaceId size={20} />{t('iwallet.send.review')}
        </button>
      </form>
    </div>
  );
}

export default function Send() {
  return <RequireUnlocked>{(address) => <SendBody address={address} />}</RequireUnlocked>;
}

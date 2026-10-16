import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import PageHeader from '../../ui/PageHeader';
import { IconCheck, IconCross, IconFaceId, IconScan, IconWarning } from '../../ui/icons';
import { scanQr } from '../../account/connectors/qr';
import { shortAddress } from '../../lib/address';
import { formatAmount } from '../../lib/format';
import { IWALLET_ED } from '../../config/iwallet-network';
import { getMainnetApi } from '../chain';
import { loadAssetBalances, loadHezBalance } from '../data';
import { hasFaceId } from '../faceid';
import { parseAmount } from '../amount';
import { parseRecipient } from '../address';
import {
  LARGE_HEZ, SEND_TOKENS, buildTransfer, estimateFee, maxSendable, needsLargeAck, tokenInfo, type SendToken,
} from '../tx';
import { useSignedTx } from '../useSignedTx';
import { AuthConfirm } from '../AuthConfirm';
import CopyAddress from '../CopyAddress';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

const FEE_DEBOUNCE_MS = 400;
// Headroom over the estimated fee when computing Max, so a fee that moves a little cannot push the send over the edge.
const feeWithMargin = (fee: bigint): bigint => fee + (fee + 9n) / 10n;
type Phase = 'form' | 'confirm';
type Balances = { hez: bigint | null; assets: Record<number, bigint> } | 'failed' | null;

function SendBody({ address }: { address: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const nav = useNavigate();
  const signer = useSignedTx();
  const { outcome } = signer;

  const [phase, setPhase] = useState<Phase>('form');
  const [to, setTo] = useState('');
  const [token, setToken] = useState<SendToken>('HEZ');
  const [amountText, setAmountText] = useState('');
  const [ack, setAck] = useState(false);
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [balances, setBalances] = useState<Balances>(null);
  const [feeResult, setFeeResult] = useState<{ key: string; fee: bigint | null } | null>(null);
  const [maxBusy, setMaxBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [scanError, setScanError] = useState(false);
  const [face, setFace] = useState(false);
  const [blockNo, setBlockNo] = useState<{ hash: string; n: number } | null>(null);

  const info = tokenInfo(token);
  const recipient = useMemo(() => parseRecipient(to), [to]);
  const toNorm = recipient.ok ? recipient.address : null;
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
  // Until the fee for the CURRENT amount is back, sending stays disabled; a failed estimate is shown as "—".
  const feeAmount = amount !== null && amount > 0n ? amount : 1n;
  const feeTo = toNorm ?? address;
  const feeKey = `${token}|${feeTo}|${feeAmount}`;
  const feeState: 'pending' | 'failed' | bigint = !api || feeResult?.key !== feeKey ? 'pending' : (feeResult.fee ?? 'failed');
  const fee = typeof feeState === 'bigint' ? feeState : null;
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

  // The block number of a finalized transfer, looked up once.
  const finalizedBlock = outcome.kind === 'finalized' ? outcome.blockHash : null;
  useEffect(() => {
    if (!api || !finalizedBlock) return;
    let live = true;
    api.rpc.chain.getHeader(finalizedBlock).then(
      (h) => { if (live) setBlockNo({ hash: finalizedBlock, n: h.number.toNumber() }); },
      () => undefined,
    );
    return () => { live = false; };
  }, [api, finalizedBlock]);

  const maxAmount = balance === null ? null
    : maxSendable(balance, info.assetId === null ? (fee ?? 0n) : 0n, IWALLET_ED.assetHub, token);
  const large = needsLargeAck(token, amount);
  // The fee is paid in HEZ and withdrawn with the account kept alive, so an asset send needs fee + ED in HEZ.
  const noFee = info.assetId !== null && fee !== null && hezSpendable !== null && hezSpendable < fee + IWALLET_ED.assetHub;
  const exceeds = amount !== null && maxAmount !== null && amount > maxAmount;

  const addressError = to.trim() !== '' && !recipient.ok;
  const own = useMemo(() => parseRecipient(address), [address]);
  const isSelf = toNorm !== null && own.ok && own.address === toNorm;
  let amountError: string | null = null;
  if (amountText.trim() !== '' && amount === null) {
    amountError = /^\d*[.,]\d+$/.test(amountText.trim()) ? t('iwallet.send.decimals', { symbol: info.symbol, n: info.decimals }) : t('iwallet.send.amountInvalid');
  } else if (exceeds) amountError = t('iwallet.send.exceeds');

  const canReview = toNorm !== null && amount !== null && amount > 0n && balance !== null && !exceeds && !noFee
    && feeState !== 'pending' && !maxBusy && (!large || ack) && !signer.busy;
  const money = (v: bigint, tk: SendToken = token) => formatAmount(v, tokenInfo(tk).decimals, tk, lang);
  const toText = (v: bigint, decimals: number): string => {
    const x = v.toString().padStart(decimals + 1, '0');
    const frac = x.slice(x.length - decimals).replace(/0+$/, '');
    const whole = x.slice(0, x.length - decimals);
    return frac ? `${whole}.${frac}` : whole;
  };

  // HEZ Max prices the call at the largest amount it could carry (the whole balance), whose fee is at least that of
  // any smaller amount, then keeps a 10% margin on it.
  const fillMax = async () => {
    if (balance === null) return;
    setAck(false);
    if (info.assetId !== null) { setAmountText(toText(balance, info.decimals)); return; }
    if (!api) return;
    setMaxBusy(true);
    try {
      const f = await estimateFee(buildTransfer(api, token, feeTo, balance), address);
      if (f !== null) setAmountText(toText(maxSendable(balance, feeWithMargin(f), IWALLET_ED.assetHub, token), info.decimals));
    } catch { /* the amount stays as typed */ } finally { setMaxBusy(false); }
  };

  const review = (e: FormEvent) => { e.preventDefault(); if (canReview) { signer.setAuthError(null); setPhase('confirm'); } };
  const doSend = (password: string) => {
    if (!api || toNorm === null || amount === null) return;
    void signer.run(api, () => buildTransfer(api, token, toNorm, amount), password);
  };
  const reset = () => {
    signer.reset(); setPhase('form'); setTo(''); setAmountText(''); setAck(false); setMaxBusy(false); setScanError(false); setScanning(false);
  };

  if (outcome.kind !== 'idle') {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.send.title', { token })} />
        <div className="iw-body iw-result" aria-live="polite">
          {outcome.kind === 'pending' && <p className="iw-lead" role="status">{t('iwallet.send.pending')}</p>}
          {outcome.kind === 'inBlock' && <p className="iw-lead" role="status">{t('iwallet.send.inBlock')}</p>}
          {outcome.kind === 'slow' && <p className="iw-note" role="status">{t('iwallet.send.slow')}</p>}
          {outcome.kind === 'finalized' && <>
            <span className="iw-result-icon"><IconCheck size={32} /></span>
            <h2 className="iw-h1">{t('iwallet.send.doneTitle')}</h2>
            <p className="iw-lead">{amount !== null ? money(amount) : ''} → <bdi dir="ltr">{shortAddress(toNorm ?? '')}</bdi></p>
            {blockNo?.hash === outcome.blockHash && <p className="iw-lead">{t('iwallet.send.recordNo')}: <bdi dir="ltr">{blockNo.n}</bdi></p>}
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
          {/* Leaving does not cancel a transfer that is already on its way, so Done is always offered. */}
          <button type="button" className="iw-primary" onClick={() => nav('/i-wallet')}>{t('iwallet.send.done')}</button>
          {outcome.kind !== 'pending' && outcome.kind !== 'inBlock' && (
            <button type="button" className="iw-secondary" onClick={reset}>{t('iwallet.send.another')}</button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.send.confirmTitle')} />
        <AuthConfirm
          summary={(
            <dl className="iw-summary">
              <dt>{t('iwallet.send.to')}</dt><dd><bdi dir="ltr">{toNorm}</bdi></dd>
              <dt>{t('iwallet.send.amount')}</dt><dd><bdi dir="ltr">{amount !== null ? money(amount) : ''}</bdi></dd>
              <dt>{t('iwallet.send.feeLabel')}</dt><dd><bdi dir="ltr">{fee !== null ? money(fee, 'HEZ') : '—'}</bdi></dd>
            </dl>
          )}
          busy={signer.busy}
          error={signer.authError}
          face={face}
          onPassword={doSend}
          onFaceFailed={() => signer.setAuthError(t('iwallet.send.faceFailed'))}
          onBack={() => { setPhase('form'); signer.setAuthError(null); }}
          submitLabel={t('iwallet.send.confirm')}
        />
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
        {addressError && <p className="iw-error" role="alert">{t(!recipient.ok && recipient.reason === 'network' ? 'iwallet.send.otherNetwork' : 'iwallet.send.invalid')}</p>}
        {isSelf && <p className="iw-note" role="status">{t('iwallet.send.self')}</p>}

        <div className="iw-field">
          <label htmlFor="iw-send-amount">{t('iwallet.send.amount')}</label>
          <span className={`iw-amount-box${large ? ' big' : ''}`}>
            <input id="iw-send-amount" type="text" inputMode="decimal" dir="ltr" value={amountText} placeholder="0" autoComplete="off"
              onChange={(e) => { setAmountText(e.target.value); setAck(false); }} />
            <span className="sym">{token}</span>
            <button type="button" className="iw-max" disabled={balance === null || maxBusy || (info.assetId === null && !api)} onClick={() => void fillMax()}>{t('iwallet.send.max')}</button>
          </span>
        </div>
        {/* What the typed text means, so "1.000" visibly reads as 1 and nobody under-sends by a thousand. */}
        {amount !== null && amountText.trim() !== '' && <p className="iw-meta" role="status"><span>{t('iwallet.send.parsed', { amount: money(amount) })}</span></p>}
        {amountError && <p className="iw-error" role="alert">{amountError}</p>}
        <div className="iw-meta">
          <span>{balances === 'failed' ? t('iwallet.send.balanceFailed') : t('iwallet.send.available', { amount: balance === null ? '—' : money(balance) })}</span>
          <span aria-busy={feeState === 'pending'}>{fee === null ? t('iwallet.send.feeUnknown') : t('iwallet.send.fee', { fee: money(fee, 'HEZ') })}</span>
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

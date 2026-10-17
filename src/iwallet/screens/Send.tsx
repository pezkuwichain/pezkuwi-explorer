import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import PageHeader from '../../ui/PageHeader';
import { IconFaceId, IconScan, IconWarning } from '../../ui/icons';
import { ChainIcon, TokenIcon } from '../../ui/assetIcons';
import { HOLDING_CHAINS } from '../../ui/holdingChains';
import '../../ui/Holdings.css';
import { scanQr } from '../../account/connectors/qr';
import { shortAddress } from '../../lib/address';
import { formatAmount } from '../../lib/format';
import { IWALLET_ED, IWALLET_NETWORK } from '../../config/iwallet-network';
import type { ChainKey } from '../../config/network';
import { getMainnetApi } from '../chain';
import { chainSpendable, loadAssetBalances } from '../data';
import { hasFaceId } from '../faceid';
import { parseAmount } from '../amount';
import { parseRecipient } from '../address';
import {
  LARGE_HEZ, SEND_TOKENS, buildTransfer, estimateFee, maxSendable, needsLargeAck, tokenInfo, type SendToken,
} from '../tx';
import { useSignedTx } from '../useSignedTx';
import { AuthConfirm } from '../AuthConfirm';
import { TxResult, txSettled } from '../TxResult';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

const FEE_DEBOUNCE_MS = 400;
// Headroom over the estimated fee when computing Max, so a fee that moves a little cannot push the send over the edge.
const feeWithMargin = (fee: bigint): bigint => fee + (fee + 9n) / 10n;
// The Pezkuwi Wallet's send flow: the token, then (HEZ only, which lives on all three chains) the network, then the
// transfer on that network. PEZ and USDT are Asset Hub assets, so they skip the network step.
type Phase = 'token' | 'network' | 'form' | 'confirm';
type Balances = { hez: bigint | null; assets: Record<number, bigint> } | 'failed' | null;
const isChain = (v: string | null): v is ChainKey => v !== null && (HOLDING_CHAINS as readonly string[]).includes(v);
const isToken = (v: string | null): v is SendToken => v !== null && (SEND_TOKENS as readonly string[]).includes(v);

// /i-wallet/send?token=HEZ&chain=relay|assetHub|people opens straight on that transfer; a value that is not one of
// those is ignored (the person then picks it).
function fromLink(params: URLSearchParams): { phase: Phase; token: SendToken; chain: ChainKey } {
  const tk = params.get('token');
  const ch = params.get('chain');
  if (!isToken(tk)) return { phase: 'token', token: 'HEZ', chain: 'assetHub' };
  if (tk !== 'HEZ') return { phase: 'form', token: tk, chain: 'assetHub' };
  return isChain(ch) ? { phase: 'form', token: tk, chain: ch } : { phase: 'network', token: tk, chain: 'assetHub' };
}

function TokenStep({ onPick }: { onPick: (t: SendToken) => void }) {
  const { t } = useTranslation();
  const sub = (tk: SendToken) => {
    if (tk === 'HEZ') return 'PezkuwiChain';
    const std = IWALLET_NETWORK.assets.find((a) => a.symbol === tk)?.standard;
    return std ? `${t('chain.assetHub')} (${std})` : t('chain.assetHub');
  };
  return (
    <div className="iw">
      <PageHeader title={t('iwallet.home.send')} />
      <div className="iw-body">
        <section className="tokens iw-pick-list" aria-label={t('iwallet.send.token')}>
          <ul>{SEND_TOKENS.map((tk) => (
            <li key={tk} className="token-row">
              <button type="button" className="iw-pick" onClick={() => onPick(tk)}>
                <TokenIcon symbol={tk} />
                <span className="token-name"><span className="token-symbol">{tk}</span><span className="token-chain">{sub(tk)}</span></span>
              </button>
            </li>))}</ul>
        </section>
      </div>
    </div>
  );
}

// Each network with what can be sent from it there (free minus frozen, as the wallet's "transferable"); one network
// failing to load says so on its own row and never hides the others.
function NetworkStep({ address, token, onPick }: { address: string; token: SendToken; onPick: (c: ChainKey) => void }) {
  const { t, i18n } = useTranslation();
  const [bal, setBal] = useState<Partial<Record<ChainKey, bigint | 'failed'>>>({});
  const [run, setRun] = useState(0);
  useEffect(() => {
    let live = true;
    for (const c of HOLDING_CHAINS) {
      chainSpendable(c, address).then(
        (v) => { if (live) setBal((b) => ({ ...b, [c]: v })); },
        () => { if (live) setBal((b) => ({ ...b, [c]: 'failed' })); },
      );
    }
    return () => { live = false; };
  }, [address, run]);
  const { decimals, symbol } = IWALLET_NETWORK.native;
  return (
    <div className="iw">
      <PageHeader title={t('iwallet.send.title', { token })} />
      <div className="iw-body">
        <p className="iw-lead">{t('iwallet.send.networkTitle', { token })}</p>
        <section className="tokens iw-pick-list" aria-label={t('iwallet.send.network')}>
          <ul>{HOLDING_CHAINS.map((c) => {
            const v = bal[c];
            return (
              <li key={c} className="token-row">
                {v === 'failed' ? (
                  <div className="iw-pick">
                    <ChainIcon chain={c} />
                    <span className="token-name"><span className="token-symbol">{t(`chain.${c}`)}</span>
                      <span className="token-chain">{t('state.error')} <button type="button" className="retry" onClick={() => { setBal((b) => ({ ...b, [c]: undefined })); setRun((n) => n + 1); }}>{t('state.retry')}</button></span>
                    </span>
                  </div>
                ) : (
                  <button type="button" className="iw-pick" onClick={() => onPick(c)} aria-busy={v === undefined}>
                    <ChainIcon chain={c} />
                    <span className="token-name"><span className="token-symbol">{t(`chain.${c}`)}</span>
                      <span className="token-chain">{t('iwallet.send.available', { amount: v === undefined ? '—' : formatAmount(v, decimals, symbol, i18n.language) })}</span>
                    </span>
                  </button>
                )}
              </li>
            );
          })}</ul>
        </section>
      </div>
    </div>
  );
}

function SendBody({ address }: { address: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const nav = useNavigate();
  const signer = useSignedTx();
  const { outcome } = signer;

  const [params] = useSearchParams();
  const [start] = useState(() => fromLink(params));
  const [phase, setPhase] = useState<Phase>(start.phase);
  const [to, setTo] = useState('');
  const [token, setToken] = useState<SendToken>(start.token);
  const [chain, setChain] = useState<ChainKey>(start.chain);
  const [amountText, setAmountText] = useState('');
  const [ack, setAck] = useState(false);
  const [conn, setConn] = useState<{ chain: ChainKey; api: ApiPromise } | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; value: Balances } | null>(null);
  const [feeResult, setFeeResult] = useState<{ key: string; fee: bigint | null } | null>(null);
  const [feeTry, setFeeTry] = useState(0);
  const [maxBusy, setMaxBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [scanError, setScanError] = useState(false);
  const [face, setFace] = useState(false);
  const [blockNo, setBlockNo] = useState<{ hash: string; n: number } | null>(null);
  const [balanceRun, setBalanceRun] = useState(0);

  const info = tokenInfo(token);
  // Everything below is bound to the chosen network: its connection, balance, fee and existential deposit.
  const api = conn?.chain === chain ? conn.api : null;
  const ed = IWALLET_ED[chain];
  const balanceKey = `${token}|${chain}|${balanceRun}`;
  const balances: Balances = loaded?.key === balanceKey ? loaded.value : null;
  const recipient = useMemo(() => parseRecipient(to), [to]);
  const toNorm = recipient.ok ? recipient.address : null;
  const amount = useMemo(() => parseAmount(amountText, info.decimals), [amountText, info.decimals]);

  const onForm = phase === 'form' || phase === 'confirm';
  // The connection to the chosen network (the genesis check in getMainnetApi applies to each).
  useEffect(() => {
    if (!onForm) return;
    let live = true;
    getMainnetApi(chain).then((a) => { if (live) setConn({ chain, api: a }); }, () => undefined);
    return () => { live = false; };
  }, [chain, onForm]);
  useEffect(() => {
    let live = true;
    hasFaceId().then((v) => { if (live) setFace(v); }, () => undefined);
    return () => { live = false; };
  }, [address]);
  // Only what this transfer needs, on its own network: HEZ reads the spendable HEZ there; an asset reads Asset Hub's
  // HEZ (for the fee) and the asset balances. No other network is read, so its outage never blocks this send.
  // Read again after every send (balanceRun).
  useEffect(() => {
    if (!onForm) return;
    let live = true;
    const key = balanceKey;
    const read: Promise<Balances> = token === 'HEZ'
      ? chainSpendable(chain, address).then((hez) => ({ hez, assets: {} }))
      : Promise.all([chainSpendable('assetHub', address), loadAssetBalances(address)])
        .then(([hez, a]) => ({ hez, assets: Object.fromEntries(a.map((x) => [x.id, x.amount])) }));
    read.then((value) => { if (live) setLoaded({ key, value }); }, () => { if (live) setLoaded({ key, value: 'failed' }); });
    return () => { live = false; };
  }, [address, token, chain, balanceKey, onForm]);

  const hezSpendable = balances && balances !== 'failed' ? balances.hez : null;
  const balance = balances && balances !== 'failed'
    ? (info.assetId === null ? balances.hez : (balances.assets[info.assetId] ?? 0n))
    : null;

  // The fee comes from paymentInfo on the call as it would be sent (a unit amount until one is typed), debounced.
  // Until the fee for the CURRENT amount is back, sending stays disabled; a failed estimate is shown as "—".
  const feeAmount = amount !== null && amount > 0n ? amount : 1n;
  const feeTo = toNorm ?? address;
  const feeKey = `${chain}|${token}|${feeTo}|${feeAmount}|${feeTry}`;
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
    : maxSendable(balance, info.assetId === null ? (fee ?? 0n) : 0n, ed, token);
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

  // A HEZ send is priced by the node; with no estimate the person would sign an unknown fee, so Review waits for a retry.
  const feeBlocked = info.assetId === null && feeState === 'failed';
  const canReview = toNorm !== null && amount !== null && amount > 0n && balance !== null && !exceeds && !noFee
    && feeState !== 'pending' && !feeBlocked && !maxBusy && (!large || ack) && !signer.busy;
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
      if (f !== null) setAmountText(toText(maxSendable(balance, feeWithMargin(f), ed, token), info.decimals));
    } catch { /* the amount stays as typed */ } finally { setMaxBusy(false); }
  };

  const review = (e: FormEvent) => { e.preventDefault(); if (canReview) { signer.setAuthError(null); setPhase('confirm'); } };
  const doSend = (password: string) => {
    if (!api || toNorm === null || amount === null) return;
    void signer.run(api, () => buildTransfer(api, token, toNorm, amount), password).then((o) => {
      // The old "Available" and Max are stale once anything may have left: read them again.
      if (o !== null) setBalanceRun((n) => n + 1);
    });
  };
  const pickToken = (tk: SendToken) => {
    if (tk !== token) { setAmountText(''); setAck(false); }
    setToken(tk);
    if (tk === 'HEZ') setPhase('network');
    else { setChain('assetHub'); setPhase('form'); }
  };
  const pickChain = (c: ChainKey) => { if (c !== chain) { setAmountText(''); setAck(false); } setChain(c); setPhase('form'); };
  const chainName = t(`chain.${chain}`);
  const reset = () => {
    signer.reset(); setPhase('form'); setTo(''); setAmountText(''); setAck(false); setMaxBusy(false); setScanError(false); setScanning(false);
  };

  if (outcome.kind !== 'idle') {
    return (
      <TxResult
        title={t('iwallet.send.title', { token })}
        outcome={outcome}
        doneTitle={t('iwallet.send.doneTitle')}
        failedTitle={t('iwallet.send.failedTitle')}
        interrupted={t('iwallet.send.interrupted')}
        detail={outcome.kind === 'finalized' && <>
          <p className="iw-lead">{amount !== null ? money(amount) : ''} → <bdi dir="ltr">{shortAddress(toNorm ?? '')}</bdi></p>
          <p className="iw-lead">{t('iwallet.send.network')}: {chainName}</p>
          {blockNo?.hash === outcome.blockHash && <p className="iw-lead">{t('iwallet.send.recordNo')}: <bdi dir="ltr">{blockNo.n}</bdi></p>}
        </>}
        actions={<>
          {/* Leaving does not cancel a transfer that is already on its way, so Done is always offered. */}
          <button type="button" className="iw-primary" onClick={() => nav('/i-wallet')}>{t('iwallet.send.done')}</button>
          {txSettled(outcome) && <button type="button" className="iw-secondary" onClick={reset}>{t('iwallet.send.another')}</button>}
        </>}
      />
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.send.confirmTitle')} />
        <AuthConfirm
          summary={(
            <dl className="iw-summary">
              <dt>{t('iwallet.send.network')}</dt><dd>{chainName}</dd>
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

  if (phase === 'token') return <TokenStep onPick={pickToken} />;
  if (phase === 'network') return <NetworkStep address={address} token={token} onPick={pickChain} />;

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.send.title', { token })} />
      <form className="iw-body iw-form" onSubmit={review}>
        <div className="iw-sendon">
          <TokenIcon symbol={token} size={28} />
          <span className="iw-sendon-text"><strong>{token}</strong><span><ChainIcon chain={chain} size={14} /> {chainName}</span></span>
          <button type="button" className="iw-secondary iw-change" disabled={maxBusy} onClick={() => { setAck(false); setPhase('token'); }}>{t('iwallet.send.change')}</button>
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
        {feeBlocked && (
          <p className="iw-error" role="alert">
            {t('iwallet.send.feeFailed')} <button type="button" className="retry" onClick={() => setFeeTry((n) => n + 1)}>{t('state.retry')}</button>
          </p>
        )}

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

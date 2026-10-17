import { formatCitizenUid } from '../../citizen/citizenUid';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import PageHeader from '../../ui/PageHeader';
import { IconCheckCircle, IconClock, IconWarning } from '../../ui/icons';
import { shortAddress } from '../../lib/address';
import { formatAmount } from '../../lib/format';
import { IWALLET_ED, IWALLET_NETWORK } from '../../config/iwallet-network';
import { getMainnetApi } from '../chain';
import { hasFaceId } from '../faceid';
import { estimateFee } from '../tx';
import { parseRecipient } from '../address';
import {
  FUNDING_POLL, assetHubNeed, buildApply, buildApprove, buildCancel, buildConfirm, buildTeleportToPeople, chainSpendable,
  clearTeleportSent, formProblems, identityHash, kycDeposit, loadForm, loadStatus, markTeleportSent, needsFunding, parseReferrer,
  REFERRALS_PAGE, canRefer, myReferrals, referralLink, rememberedReferrer, saveForm, stageOf, teleportAmount, teleportGuardActive,
  type CitizenForm, type CitizenStatus, type MyReferral,
} from '../citizen';
import { AuthConfirm } from '../AuthConfirm';
import { useSignedTx } from '../useSignedTx';
import CopyAddress from '../CopyAddress';
import { TxResult, txSettled } from '../TxResult';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

type Loaded = {
  people: ApiPromise; assetHub: ApiPromise;
  status: CitizenStatus;
  deposit: bigint; peopleFree: bigint; ahFree: bigint;
  // The apply fee without and with a referrer (Some adds 32 bytes; any address prices the same).
  applyFee: { none: bigint | null; some: bigint | null }; teleportFee: bigint | null;
};
type Action =
  | { kind: 'apply'; hash: string; referrer: string | null }
  | { kind: 'confirm' } | { kind: 'cancel' }
  | { kind: 'approve'; applicant: string }
  | { kind: 'teleport'; amount: bigint };
type Funding = 'idle' | 'waiting' | 'late';
const ZERO_HASH = `0x${'0'.repeat(64)}`;
// A referrer is a mainnet account: the same SS58 rule as a Send recipient (checksum + prefix 42), never the explorer's helper (src/lib/address.ts, which follows the explorer's network).
const mainnetAddress = (text: string): string | null => { const r = parseRecipient(text); return r.ok ? r.address : null; };

// The citizenship status, balances and fees. The referral list loads on its own after this (CitizenBody), so a slow
// or failed scan never holds back or replaces the citizen card.
async function load(address: string): Promise<Loaded> {
  const [people, assetHub] = await Promise.all([getMainnetApi('people'), getMainnetApi('assetHub')]);
  const deposit = kycDeposit(people);
  const [status, peopleFree, ahFree, feeNone, feeSome, teleportFee] = await Promise.all([
    loadStatus(address),
    chainSpendable('people', address),
    chainSpendable('assetHub', address),
    estimateFee(buildApply(people, ZERO_HASH, null), address),
    estimateFee(buildApply(people, ZERO_HASH, address), address),
    estimateFee(buildTeleportToPeople(assetHub, address, teleportAmount(deposit)), address),
  ]);
  return { people, assetHub, status, deposit, peopleFree, ahFree, applyFee: { none: feeNone, some: feeSome }, teleportFee };
}

function CitizenBody({ address }: { address: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [params] = useSearchParams();
  const hez = (v: bigint) => formatAmount(v, IWALLET_NETWORK.native.decimals, IWALLET_NETWORK.native.symbol, lang);

  const [data, setData] = useState<Loaded | 'failed' | null>(null);
  const [face, setFace] = useState(false);
  const [form, setForm] = useState<CitizenForm>(() => {
    const f = loadForm(address);
    // ?ref= on this screen wins; otherwise the one the short address brought to /i-wallet earlier in this session
    // fills an empty field.
    const ref = params.get('ref');
    if (ref) return { ...f, referrer: ref };
    const remembered = rememberedReferrer();
    return remembered && !f.referrer ? { ...f, referrer: remembered } : f;
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<'main' | 'confirm'>('main');
  const [action, setAction] = useState<Action | null>(null);
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeFailed, setFeeFailed] = useState(false);
  const feeRun = useRef(0);
  // A teleport sent earlier in this session (even before leaving this screen or an auto-lock) is still landing:
  // start by waiting for it, never with the teleport button.
  const [funding, setFunding] = useState<Funding>(() => (teleportGuardActive(address) ? 'waiting' : 'idle'));
  const signer = useSignedTx();

  // Each load cancels the one before it, so an older load can never overwrite newer data.
  const cancelLoad = useRef<() => void>(() => undefined);
  // The referral list: read once per page view and kept across refreshes, read again after a failure, after any
  // approve (a refused one means the row was stale), or on Retry. Only an Approved account can be a referrer (the
  // pallet's rule), so nobody else pays for the scan or sees the list.
  const [refs, setRefs] = useState<MyReferral[] | 'loading' | 'failed'>('loading');
  const refsFresh = useRef(false);
  const cancelRefs = useRef<() => void>(() => undefined);
  const loadRefs = useCallback(() => {
    cancelRefs.current();
    let live = true;
    cancelRefs.current = () => { live = false; };
    refsFresh.current = true;
    setRefs('loading');
    myReferrals(address).then((l) => { if (live) setRefs(l); }, () => { if (live) { refsFresh.current = false; setRefs('failed'); } });
  }, [address]);
  const fetchData = useCallback(() => {
    cancelLoad.current();
    let live = true;
    cancelLoad.current = () => { live = false; };
    load(address).then((d) => {
      if (!live) return;
      setData(d);
      if (canRefer(d.status) && !refsFresh.current) loadRefs();
    }, () => { if (live) setData('failed'); });
  }, [address, loadRefs]);
  useEffect(() => { fetchData(); return () => { cancelLoad.current(); cancelRefs.current(); }; }, [fetchData]);
  const refresh = () => { setData(null); fetchData(); };
  useEffect(() => {
    let live = true;
    hasFaceId().then((v) => { if (live) setFace(v); }, () => undefined);
    return () => { live = false; };
  }, []);

  // The form stays in this browser only; it is written on every change so a reload keeps it.
  const update = (patch: Partial<CitizenForm>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      setSaveFailed(!saveForm(address, next));
      return next;
    });
  };

  const loaded = data && data !== 'failed' ? data : null;
  // The apply fee as it will be sent: with a referrer when one is typed.
  const applyFee = (loaded && (form.referrer.trim() ? loaded.applyFee.some : loaded.applyFee.none)) ?? 0n;
  const needFunds = loaded !== null && needsFunding(loaded.peopleFree, loaded.deposit, applyFee, IWALLET_ED.people);

  // After a teleport, People is polled every 6 s for up to 2 min; Apply enables as soon as the HEZ lands.
  const deposit = loaded?.deposit;
  useEffect(() => {
    if (funding !== 'waiting' || deposit === undefined) return;
    let live = true;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started >= FUNDING_POLL.forMs) { clearInterval(timer); if (live) setFunding('late'); return; }
      chainSpendable('people', address).then((free) => {
        if (!live) return;
        setData((d) => (d && d !== 'failed' ? { ...d, peopleFree: free } : d));
        if (!needsFunding(free, deposit, applyFee, IWALLET_ED.people)) { clearInterval(timer); clearTeleportSent(address); setFunding('idle'); }
      }, () => undefined);
    }, FUNDING_POLL.everyMs);
    return () => { live = false; clearInterval(timer); };
  }, [funding, deposit, applyFee, address]);

  const referrer = useMemo(() => parseReferrer(form.referrer, address, mainnetAddress), [form.referrer, address]);
  const problems = formProblems(form);

  const txFor = (a: Action, d: Loaded) => {
    switch (a.kind) {
      case 'apply': return () => buildApply(d.people, a.hash, a.referrer);
      case 'confirm': return () => buildConfirm(d.people);
      case 'cancel': return () => buildCancel(d.people);
      case 'approve': return () => buildApprove(d.people, a.applicant);
      case 'teleport': return () => buildTeleportToPeople(d.assetHub, address, a.amount);
    }
  };
  const apiFor = (a: Action, d: Loaded) => (a.kind === 'teleport' ? d.assetHub : d.people);

  // The fee is part of what is signed: without an estimate the action stays blocked until a retry succeeds.
  const priceAction = (a: Action, d: Loaded) => {
    const run = ++feeRun.current;
    setFee(null); setFeeFailed(false);
    let tx;
    try { tx = txFor(a, d)(); } catch { setFeeFailed(true); return; }
    void estimateFee(tx, address).then((f) => {
      if (run !== feeRun.current) return;
      if (f === null) setFeeFailed(true); else setFee(f);
    });
  };
  const review = (a: Action) => {
    if (!loaded) return;
    setAction(a); signer.reset(); setPhase('confirm');
    priceAction(a, loaded);
  };

  const sign = async (password: string) => {
    if (!loaded || !action) return;
    // The result screen shows once the password has decrypted the key (the outcome leaves 'idle').
    const result = await signer.run(apiFor(action, loaded), txFor(action, loaded), password);
    if (result === null) return;
    // Unless the teleport is proven failed (ExtrinsicFailed, or refused before it left), it may still land: poll People
    // and keep the teleport button away, so an unknown outcome never invites a second teleport.
    if (action.kind === 'teleport' && result.kind !== 'failed') { markTeleportSent(address); setFunding('waiting'); }
    if (action.kind === 'approve') refsFresh.current = false;
  };

  const backToMain = () => { setPhase('main'); setAction(null); signer.reset(); refresh(); };

  const apply = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (problems.length || !referrer.ok || !agreed || needFunds) return;
    review({ kind: 'apply', hash: identityHash(form, address), referrer: referrer.value });
  };

  if (signer.outcome.kind !== 'idle' && action) {
    const o = signer.outcome;
    return (
      <TxResult
        title={t('iwallet.citizen.title')}
        outcome={o}
        doneTitle={t(`iwallet.citizen.done.${action.kind}`)}
        failedTitle={t('iwallet.citizen.failedTitle')}
        interrupted={t('iwallet.citizen.interrupted')}
        actions={txSettled(o) && <button type="button" className="iw-primary" onClick={backToMain}>{t('iwallet.citizen.back')}</button>}
      />
    );
  }

  if (phase === 'confirm' && action && loaded) {
    const chain = action.kind === 'teleport' ? 'assetHub' : 'people';
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.citizen.confirmTitle')} />
        <AuthConfirm
          summary={(
            <dl className="iw-summary">
              <dt>{t('iwallet.citizen.row.action')}</dt><dd>{t(`iwallet.citizen.act.${action.kind}`)}</dd>
              <dt>{t('iwallet.citizen.row.chain')}</dt><dd>{t(`iwallet.citizen.chain.${chain}`)}</dd>
              {action.kind === 'apply' && <>
                <dt>{t('iwallet.citizen.row.referrer')}</dt>
                <dd>{action.referrer ? <bdi dir="ltr">{action.referrer}</bdi> : t('iwallet.citizen.defaultReferrer')}</dd>
                <dt>{t('iwallet.citizen.row.deposit')}</dt><dd><bdi dir="ltr">{hez(loaded.deposit)}</bdi></dd>
              </>}
              {action.kind === 'approve' && <><dt>{t('iwallet.citizen.row.applicant')}</dt><dd><bdi dir="ltr">{action.applicant}</bdi></dd></>}
              {action.kind === 'teleport' && <>
                <dt>{t('iwallet.citizen.row.to')}</dt><dd>{t('iwallet.citizen.chain.people')}</dd>
                <dt>{t('iwallet.citizen.row.recipient')}</dt>
                <dd className="iw-addr iw-recipient"><bdi dir="ltr" className="iw-addr-text">{shortAddress(address)}</bdi><CopyAddress address={address} label={t('iwallet.citizen.copyOwn')} /></dd>
                <dt>{t('iwallet.send.amount')}</dt><dd><bdi dir="ltr">{hez(action.amount)}</bdi></dd>
              </>}
              <dt>{t('iwallet.send.feeLabel')}</dt>
              <dd>
                <bdi dir="ltr">{fee !== null ? hez(fee) : '—'}</bdi>
                {feeFailed && (
                  <span className="iw-error" role="alert">
                    {' '}{t('iwallet.send.feeFailed')} <button type="button" className="retry" onClick={() => priceAction(action, loaded)}>{t('state.retry')}</button>
                  </span>
                )}
              </dd>
            </dl>
          )}
          busy={signer.busy}
          blocked={fee === null}
          error={signer.authError}
          face={face}
          onPassword={(p) => void sign(p)}
          onFaceFailed={() => signer.setAuthError(t('iwallet.send.faceFailed'))}
          onBack={() => { feeRun.current++; setPhase('main'); setAction(null); signer.reset(); }}
          submitLabel={t('iwallet.citizen.sign')}
        />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.citizen.title')} />
        <div className="iw-body"><p className="card-note" role="status">{t('state.loading')}</p></div>
      </div>
    );
  }
  if (data === 'failed') {
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.citizen.title')} />
        <div className="iw-body">
          <p className="iw-error" role="alert">{t('iwallet.citizen.loadFailed')}</p>
          <button type="button" className="iw-secondary" onClick={refresh}>{t('state.retry')}</button>
        </div>
      </div>
    );
  }

  const { status } = data;
  const amount = teleportAmount(data.deposit);
  const ahNeed = assetHubNeed(amount, data.teleportFee ?? 0n, IWALLET_ED.assetHub);
  const peopleNeed = data.deposit + applyFee + IWALLET_ED.people;
  const stage = stageOf(status);

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.citizen.title')} />
      <div className="iw-body">
        {stage === 'form' && <>
          <p className="iw-lead">{t('iwallet.citizen.intro')}</p>
          {needFunds && (
            <section className="iw-fund" aria-labelledby="iw-fund-title">
              <h2 id="iw-fund-title" className="iw-h">{t('iwallet.citizen.fund.title')}</h2>
              <p>{t('iwallet.citizen.fund.body', { need: hez(peopleNeed), have: hez(data.peopleFree), amount: hez(amount) })}</p>
              {funding === 'waiting' && <p className="iw-note" role="status"><IconClock size={16} /> {t('iwallet.citizen.fund.waiting')}</p>}
              {funding === 'late' && <>
                <p className="iw-note" role="status">{t('iwallet.citizen.fund.late')}</p>
                <button type="button" className="iw-secondary" onClick={() => setFunding('waiting')}>{t('iwallet.citizen.fund.check')}</button>
              </>}
              {/* The teleport button only when no teleport of this session may still be landing (the guard lapses after
                  TELEPORT_GUARD_MS, so one that truly never arrived can be sent again). */}
              {(funding === 'idle' || (funding === 'late' && !teleportGuardActive(address))) && <>
                {data.ahFree < ahNeed && <p className="iw-error" role="alert">{t('iwallet.citizen.fund.noHez', { need: hez(ahNeed), have: hez(data.ahFree) })}</p>}
                <button type="button" className="iw-primary" disabled={data.ahFree < ahNeed} onClick={() => review({ kind: 'teleport', amount })}>
                  {t('iwallet.citizen.fund.cta', { amount: hez(amount) })}
                </button>
              </>}
            </section>
          )}

          <form className="iw-form" onSubmit={apply} noValidate>
            <h2 className="iw-h">{t('iwallet.citizen.form.personal')}</h2>
            <label className="iw-field">
              <span>{t('iwallet.citizen.form.fullName')}</span>
              <input type="text" value={form.fullName} onChange={(e) => update({ fullName: e.target.value })} autoComplete="off" />
            </label>
            {touched && problems.includes('fullName') && <p className="iw-error" role="alert">{t('iwallet.citizen.form.required')}</p>}

            <label className="iw-field">
              <span>{t('iwallet.citizen.form.referrer')}</span>
              <input type="text" dir="ltr" value={form.referrer} onChange={(e) => update({ referrer: e.target.value })} spellCheck={false} autoComplete="off" />
            </label>
            {!referrer.ok
              ? <p className="iw-error" role="alert">{t(referrer.reason === 'self' ? 'iwallet.err.identityKyc.SelfReferral' : 'iwallet.citizen.form.referrerInvalid')}</p>
              : <p className="iw-a2hs">{t('iwallet.citizen.form.referrerNote')}</p>}

            <p className="iw-note">{t('iwallet.citizen.form.privacy')}</p>
            {saveFailed && <p className="iw-error" role="alert">{t('iwallet.citizen.form.notSaved')}</p>}

            <div className="iw-fire">
              <IconWarning size={18} />
              <div className="iw-warning-text">
                <strong>{t('iwallet.citizen.deposit.title', { amount: hez(data.deposit) })}</strong>
                <span>{t('iwallet.citizen.deposit.body', { amount: hez(data.deposit) })}</span>
              </div>
            </div>

            <label className="iw-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              {t('iwallet.citizen.form.agree')}
            </label>
            {touched && problems.length > 0 && <p className="iw-error" role="alert">{t('iwallet.citizen.form.fix')}</p>}
            <button type="submit" className="iw-primary" disabled={!agreed || needFunds || !referrer.ok}>{t('iwallet.citizen.apply')}</button>
          </form>
        </>}

        {stage === 'pending' && (
          <section className="iw-stage">
            <IconClock size={28} />
            <h2 className="iw-h1">{t('iwallet.citizen.pending.title')}</h2>
            <p className="iw-lead">{t('iwallet.citizen.pending.body')}</p>
            <p className="iw-a2hs">{t('iwallet.citizen.pending.depositBack')}</p>
            <button type="button" className="iw-danger" onClick={() => review({ kind: 'cancel' })}>{t('iwallet.citizen.cancel')}</button>
          </section>
        )}

        {stage === 'sign' && (
          <section className="iw-stage">
            <IconCheckCircle size={28} />
            <h2 className="iw-h1">{t('iwallet.citizen.approved.title')}</h2>
            <p className="iw-lead">{t('iwallet.citizen.approved.body')}</p>
            <button type="button" className="iw-primary" onClick={() => review({ kind: 'confirm' })}>{t('iwallet.citizen.confirm')}</button>
          </section>
        )}

        {stage === 'citizen' && (
          <section className="iw-stage">
            <IconCheckCircle size={28} />
            <h2 className="iw-h1">{t('iwallet.citizen.citizen.title')}</h2>
            {form.fullName.trim() && <p className="iw-lead">{form.fullName}</p>}
            {status.nftId !== null && <p className="iw-lead">{t('iwallet.citizen.citizen.nft', { id: status.nftId.toString() })}</p>}
            {status.nftId !== null && <p className="iw-lead"><span>{t('cid.number')}</span> <bdi dir="ltr" className="mono">{formatCitizenUid(address, status.nftId)}</bdi></p>}
          </section>
        )}
        {stage === 'approvedNoNft' && <p className="iw-note" role="status">{t('iwallet.citizen.approvedNoNft')}</p>}

        {stage === 'revoked' && <p className="iw-error" role="alert">{t('iwallet.citizen.revoked')}</p>}

        {canRefer(status) && <MyReferrals list={refs} address={address} onRetry={loadRefs} onApprove={(applicant) => review({ kind: 'approve', applicant })} />}
      </div>
    </div>
  );
}

// The wallets this citizen referred (src/iwallet/citizen.ts myReferrals), under the citizen card. The count is the list
// length, not referral.referralCount: that counter grows only when a referred citizenship is approved, while this list
// also holds the open applications that name this account (on 2026-10-17 the counter equalled the completed rows for
// every referrer).
// Rows are shown REFERRALS_PAGE at a time.
function MyReferrals({ list, address, onApprove, onRetry }: {
  list: MyReferral[] | 'loading' | 'failed'; address: string; onApprove: (applicant: string) => void; onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(REFERRALS_PAGE);
  const link = referralLink(address);
  return (
    <section className="iw-refs" aria-labelledby="iw-refs-title">
      <h2 id="iw-refs-title" className="iw-h">{t('iwallet.citizen.refs.title')}</h2>
      {list === 'loading' ? <p className="card-note" role="status">{t('state.loading')}</p>
      : list === 'failed' ? <>
        <p className="iw-error" role="alert">{t('iwallet.citizen.refs.failed')}</p>
        <button type="button" className="iw-secondary" onClick={onRetry}>{t('state.retry')}</button>
      </> : list.length === 0 ? <>
        <p className="iw-lead">{t('iwallet.citizen.refs.empty')}</p>
        <p className="iw-a2hs">{t('iwallet.citizen.refs.how')}</p>
      </> : <>
        <p className="iw-a2hs">{t('iwallet.citizen.refs.count', { count: list.length })}</p>
        {list.some((r) => r.state === 'waiting') && <p className="iw-a2hs">{t('iwallet.citizen.refs.body')}</p>}
        <ul className="iw-menu">
          {list.slice(0, shown).map((r) => (
            <li key={r.address} className="iw-ref" data-state={r.state}>
              <div className="iw-ref-main">
                <span className="iw-addr">
                  <bdi dir="ltr" className="iw-addr-text">{shortAddress(r.address)}</bdi>
                  <CopyAddress address={r.address} label={t('iwallet.citizen.refs.copyFor', { address: r.address })} />
                </span>
                <span className="iw-ref-meta">
                  <span className={`iw-ref-chip iw-ref-${r.state}`}>{t(`iwallet.citizen.refs.state.${r.state}`)}</span>
                  {r.nftId !== null && <bdi dir="ltr">{t('iwallet.citizen.citizen.nft', { id: r.nftId.toString() })}</bdi>}
                  {r.createdAt !== null && <span>{t('iwallet.send.recordNo')}: <bdi dir="ltr">{r.createdAt}</bdi></span>}
                </span>
              </div>
              {/* approve_referral accepts only an open application that names this account and reads PendingReferral. */}
              {r.state === 'waiting' && (
                <button type="button" className="iw-ref-approve" onClick={() => onApprove(r.address)}
                  aria-label={t('iwallet.citizen.refs.approveFor', { address: r.address })}>
                  {t('iwallet.citizen.refs.approve')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {list.length > shown && (
          <button type="button" className="iw-secondary" onClick={() => setShown((n) => n + REFERRALS_PAGE)}>
            {t('iwallet.citizen.refs.more', { shown, count: list.length })}
          </button>
        )}
      </>}
      <p className="iw-a2hs">{t('iwallet.citizen.refs.linkLabel')} <bdi dir="ltr" className="iw-addr-text">{link}</bdi></p>
      <CopyAddress address={link} className="iw-secondary iw-ref-copy" text={t('iwallet.citizen.refs.copyLink')} />
    </section>
  );
}

export default function Citizen() {
  return <RequireUnlocked>{(address) => <CitizenBody address={address} />}</RequireUnlocked>;
}

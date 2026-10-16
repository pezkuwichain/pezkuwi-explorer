import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import PageHeader from '../../ui/PageHeader';
import { IconCheck, IconCheckCircle, IconClock, IconCross, IconWarning } from '../../ui/icons';
import { normaliseAddress, shortAddress } from '../../lib/address';
import { formatAmount } from '../../lib/format';
import { IWALLET_ED, IWALLET_NETWORK } from '../../config/iwallet-network';
import { getMainnetApi } from '../chain';
import { hasFaceId } from '../faceid';
import { estimateFee } from '../tx';
import {
  FUNDING_POLL, REGIONS, assetHubNeed, buildApply, buildApprove, buildCancel, buildConfirm, buildTeleportToPeople, chainSpendable, formProblems,
  identityHash, kycDeposit, loadForm, loadStatus, needsFunding, parseReferrer, pendingReferrals, saveForm, teleportAmount,
  type CitizenForm, type CitizenStatus, type PendingReferral,
} from '../citizen';
import { AuthConfirm } from '../AuthConfirm';
import { useSignedTx } from '../useSignedTx';
import CopyAddress from '../CopyAddress';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

type Loaded = {
  people: ApiPromise; assetHub: ApiPromise;
  status: CitizenStatus; referrals: PendingReferral[] | 'failed';
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

// `cachedReferrals` is the referral scan from earlier in this page view; it is reused instead of scanning again.
async function load(address: string, cachedReferrals: PendingReferral[] | null): Promise<Loaded> {
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
  // Only an Approved citizen can be a referrer, so nobody else pays for the scan.
  const referrals: Loaded['referrals'] = status.kyc !== 'Approved' ? []
    : cachedReferrals ?? await pendingReferrals(address).catch((): 'failed' => 'failed');
  return { people, assetHub, status, referrals, deposit, peopleFree, ahFree, applyFee: { none: feeNone, some: feeSome }, teleportFee };
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
    const ref = params.get('ref');
    return ref ? { ...f, referrer: ref } : f;
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<'main' | 'confirm'>('main');
  const [action, setAction] = useState<Action | null>(null);
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeFailed, setFeeFailed] = useState(false);
  const feeRun = useRef(0);
  const [funding, setFunding] = useState<Funding>('idle');
  const signer = useSignedTx();

  // Each load cancels the one before it, so an older load can never overwrite newer data.
  const cancelLoad = useRef<() => void>(() => undefined);
  const referralCache = useRef<PendingReferral[] | null>(null);
  const fetchData = useCallback(() => {
    cancelLoad.current();
    let live = true;
    cancelLoad.current = () => { live = false; };
    load(address, referralCache.current).then((d) => {
      if (!live) return;
      if (d.status.kyc === 'Approved' && d.referrals !== 'failed') referralCache.current = d.referrals;
      setData(d);
    }, () => { if (live) setData('failed'); });
  }, [address]);
  useEffect(() => { fetchData(); return () => cancelLoad.current(); }, [fetchData]);
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
        if (!needsFunding(free, deposit, applyFee, IWALLET_ED.people)) { clearInterval(timer); setFunding('idle'); }
      }, () => undefined);
    }, FUNDING_POLL.everyMs);
    return () => { live = false; clearInterval(timer); };
  }, [funding, deposit, applyFee, address]);

  const referrer = useMemo(() => parseReferrer(form.referrer, address, normaliseAddress), [form.referrer, address]);
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
    if (action.kind === 'teleport' && result.kind !== 'failed') setFunding('waiting');
    if (action.kind === 'approve' && result.kind !== 'failed') referralCache.current = null;
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
      <div className="iw">
        <PageHeader title={t('iwallet.citizen.title')} />
        <div className="iw-body iw-result" aria-live="polite">
          {o.kind === 'pending' && <p className="iw-lead" role="status">{t('iwallet.send.pending')}</p>}
          {o.kind === 'inBlock' && <p className="iw-lead" role="status">{t('iwallet.send.inBlock')}</p>}
          {o.kind === 'finalized' && <>
            <span className="iw-result-icon"><IconCheck size={32} /></span>
            <h2 className="iw-h1">{t(`iwallet.citizen.done.${action.kind}`)}</h2>
            <p className="iw-lead">{t('iwallet.send.txId')}</p>
            <div className="iw-addr iw-addr-full">
              <bdi dir="ltr" className="iw-addr-text">{o.hash}</bdi>
              <CopyAddress address={o.hash} label={t('iwallet.send.copyTxId')} />
            </div>
          </>}
          {o.kind === 'failed' && <>
            <span className="iw-result-icon bad"><IconCross size={32} /></span>
            <h2 className="iw-h1">{t('iwallet.citizen.failedTitle')}</h2>
            <p className="iw-error" role="alert">{o.message}</p>
          </>}
          {o.kind === 'slow' && <p className="iw-note" role="status">{t('iwallet.send.slow')}</p>}
          {o.kind === 'interrupted' && <p className="iw-note" role="alert">{t('iwallet.citizen.interrupted')}</p>}
          {o.kind !== 'pending' && o.kind !== 'inBlock' && (
            <button type="button" className="iw-primary" onClick={backToMain}>{t('iwallet.citizen.back')}</button>
          )}
        </div>
      </div>
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
  const field = (k: 'fullName' | 'fatherName' | 'grandfatherName' | 'motherName' | 'tribe' | 'profession', label: string) => (
    <>
      <label className="iw-field">
        <span>{label}</span>
        <input type="text" value={form[k]} onChange={(e) => update({ [k]: e.target.value })} autoComplete="off" />
      </label>
      {touched && problems.includes(k) && <p className="iw-error" role="alert">{t('iwallet.citizen.form.required')}</p>}
    </>
  );
  const childCount = Math.min(Math.max(Number.parseInt(form.childrenCount, 10) || 0, 0), 20);

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.citizen.title')} />
      <div className="iw-body">
        {status.kyc === 'NotStarted' && <>
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
              {funding === 'idle' && <>
                {data.ahFree < ahNeed && <p className="iw-error" role="alert">{t('iwallet.citizen.fund.noHez', { need: hez(ahNeed), have: hez(data.ahFree) })}</p>}
                <button type="button" className="iw-primary" disabled={data.ahFree < ahNeed} onClick={() => review({ kind: 'teleport', amount })}>
                  {t('iwallet.citizen.fund.cta', { amount: hez(amount) })}
                </button>
              </>}
            </section>
          )}

          <form className="iw-form" onSubmit={apply} noValidate>
            <h2 className="iw-h">{t('iwallet.citizen.form.personal')}</h2>
            {field('fullName', t('iwallet.citizen.form.fullName'))}
            {field('fatherName', t('iwallet.citizen.form.fatherName'))}
            {field('grandfatherName', t('iwallet.citizen.form.grandfatherName'))}
            {field('motherName', t('iwallet.citizen.form.motherName'))}
            {field('tribe', t('iwallet.citizen.form.tribe'))}

            <fieldset className="iw-field iw-fieldset">
              <legend>{t('iwallet.citizen.form.marital')}</legend>
              {(['zewici', 'nezewici'] as const).map((m) => (
                <label key={m} className="iw-check">
                  <input type="radio" name="iw-marital" checked={form.maritalStatus === m} onChange={() => update({ maritalStatus: m })} />
                  {t(`iwallet.citizen.form.${m === 'zewici' ? 'married' : 'unmarried'}`)}
                </label>
              ))}
            </fieldset>
            {form.maritalStatus === 'zewici' && <>
              <label className="iw-field">
                <span>{t('iwallet.citizen.form.childrenCount')}</span>
                <input type="number" inputMode="numeric" min={0} max={20} value={form.childrenCount} onChange={(e) => update({ childrenCount: e.target.value })} />
              </label>
              {Array.from({ length: childCount }, (_, i) => {
                const c = form.children[i] ?? { name: '', birthYear: '' };
                const setChild = (patch: Partial<typeof c>) => {
                  const children = [...form.children];
                  children[i] = { ...c, ...patch };
                  update({ children });
                };
                return (
                  <div key={i} className="iw-row">
                    <input type="text" aria-label={t('iwallet.citizen.form.childName', { number: i + 1 })} placeholder={t('iwallet.citizen.form.childName', { number: i + 1 })}
                      value={c.name} onChange={(e) => setChild({ name: e.target.value })} className="iw-input" />
                    <input type="number" inputMode="numeric" aria-label={t('iwallet.citizen.form.birthYear')} placeholder={t('iwallet.citizen.form.birthYear')}
                      value={c.birthYear} onChange={(e) => setChild({ birthYear: e.target.value })} className="iw-input iw-year" />
                  </div>
                );
              })}
            </>}

            <label className="iw-field">
              <span>{t('iwallet.citizen.form.region')}</span>
              <select value={form.region} onChange={(e) => update({ region: e.target.value as CitizenForm['region'] })}>
                <option value="">{t('iwallet.citizen.form.selectRegion')}</option>
                {REGIONS.map((r) => <option key={r} value={r}>{t(`iwallet.citizen.region.${r}`)}</option>)}
              </select>
            </label>
            {touched && problems.includes('region') && <p className="iw-error" role="alert">{t('iwallet.citizen.form.required')}</p>}

            <label className="iw-field">
              <span>{t('iwallet.citizen.form.email')}</span>
              <input type="email" dir="ltr" value={form.email} onChange={(e) => update({ email: e.target.value })} autoComplete="off" />
            </label>
            {touched && problems.includes('email') && <p className="iw-error" role="alert">{t('iwallet.citizen.form.emailInvalid')}</p>}
            {field('profession', t('iwallet.citizen.form.profession'))}

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

        {status.kyc === 'PendingReferral' && (
          <section className="iw-stage">
            <IconClock size={28} />
            <h2 className="iw-h1">{t('iwallet.citizen.pending.title')}</h2>
            <p className="iw-lead">{t('iwallet.citizen.pending.body')}</p>
            <p className="iw-a2hs">{t('iwallet.citizen.pending.depositBack')}</p>
            <button type="button" className="iw-danger" onClick={() => review({ kind: 'cancel' })}>{t('iwallet.citizen.cancel')}</button>
          </section>
        )}

        {status.kyc === 'ReferrerApproved' && (
          <section className="iw-stage">
            <IconCheckCircle size={28} />
            <h2 className="iw-h1">{t('iwallet.citizen.approved.title')}</h2>
            <p className="iw-lead">{t('iwallet.citizen.approved.body')}</p>
            <button type="button" className="iw-primary" onClick={() => review({ kind: 'confirm' })}>{t('iwallet.citizen.confirm')}</button>
          </section>
        )}

        {status.kyc === 'Approved' && (status.nftId !== null
          ? (
            <section className="iw-stage">
              <IconCheckCircle size={28} />
              <h2 className="iw-h1">{t('iwallet.citizen.citizen.title')}</h2>
              <p className="iw-lead">{t('iwallet.citizen.citizen.nft', { id: status.nftId.toString() })}</p>
            </section>
          )
          : <p className="iw-note" role="status">{t('iwallet.citizen.approvedNoNft')}</p>)}

        {status.kyc === 'Revoked' && <p className="iw-error" role="alert">{t('iwallet.citizen.revoked')}</p>}

        {data.referrals === 'failed' && <p className="iw-error" role="alert">{t('iwallet.citizen.refs.failed')}</p>}
        {data.referrals !== 'failed' && data.referrals.length > 0 && (
          <section className="iw-refs" aria-labelledby="iw-refs-title">
            <h2 id="iw-refs-title" className="iw-h">{t('iwallet.citizen.refs.title')}</h2>
            <p className="iw-a2hs">{t('iwallet.citizen.refs.body')}</p>
            <ul className="iw-menu">
              {data.referrals.map((r) => (
                <li key={r.applicant} className="iw-ref">
                  <bdi dir="ltr" className="iw-addr-text">{shortAddress(r.applicant)}</bdi>
                  <button type="button" className="iw-max" onClick={() => review({ kind: 'approve', applicant: r.applicant })}
                    aria-label={t('iwallet.citizen.refs.approveFor', { address: r.applicant })}>
                    {t('iwallet.citizen.refs.approve')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default function Citizen() {
  return <RequireUnlocked>{(address) => <CitizenBody address={address} />}</RequireUnlocked>;
}

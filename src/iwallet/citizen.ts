// Citizenship on the mainnet People chain (spec §6), ported from pwap shared/lib/citizenship-workflow.ts and
// web/src/components/citizenship/NewCitizenApplication.tsx. The name never leaves this browser: only a blake2 hash
// goes on chain.
import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import { u8aEq, u8aToHex } from '@pezkuwi/util';
import { blake2AsHex, decodeAddress } from '@pezkuwi/util-crypto';
import type { ChainKey } from '../config/network';
import { IWALLET_NETWORK } from '../config/iwallet-network';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';
import { PREFIX, storage } from '../lib/storage';
import { clearAllForms, clearForm, clearTeleportSent, formKey, teleportKey } from './personal-store';

export { clearAllForms, clearForm, clearTeleportSent, formKey };
import { withTimeout } from '../lib/timeout';
import { getMainnetApi } from './chain';
import { chainSpendable } from './data';

type Tx = SubmittableExtrinsic<'promise'>;
type Deps = { getApi: (chain: ChainKey) => Promise<ApiPromise> };
const real: Deps = { getApi: getMainnetApi };

// The application asks only for a name and an optional referrer. Nothing personal goes on chain (only the hash
// below), and the name stays in this browser for the citizen card, so asking for more would only collect data that
// is never used.
export type CitizenForm = {
  fullName: string;
  referrer: string;
  // 32 random bytes as 0x-hex, made once per application and kept with the form (see identityHash).
  salt: string;
};

export const EMPTY_FORM: CitizenForm = { fullName: '', referrer: '', salt: '' };

const SALT_RE = /^0x[0-9a-f]{64}$/;
export const newSalt = (): string => u8aToHex(crypto.getRandomValues(new Uint8Array(32)));

// The on-chain identity hash. The field set shrank with the form (2026-10-17): it was pwap NewCitizenApplication.tsx's
// nine-field recipe and is now { fullName, walletAddress, salt }, so it no longer matches pwap's hash for the same
// person. Uniqueness comes from the wallet address (one application per account); the name is hashed as typed. The
// address is public, so without the salt anyone could test a guessed name against the hash on chain; with it the
// privacy text holds ("cannot be read back"). Nothing on chain or in pwap verifies the hash, so a lost salt breaks
// nothing; a person who must prove the name later shows name + salt.
export function identityHash(form: CitizenForm, address: string): string {
  return blake2AsHex(JSON.stringify({ fullName: form.fullName, walletAddress: address, salt: form.salt }), 256);
}

export type FormProblem = 'fullName';
export function formProblems(form: CitizenForm): FormProblem[] {
  return form.fullName.trim() ? [] : ['fullName'];
}

// Personal data is kept only in this browser's localStorage (via src/lib/storage.ts), keyed by the wallet address
// (formKey, clearForm, clearAllForms live in personal-store.ts).
const FORM_KEYS = ['fullName', 'referrer', 'salt'];
// Always returns a form with a salt. A new form's salt is kept in memory until the first save (nothing is written for
// someone who never types). A stored form that lacks a salt, or that still holds the long form saved before
// 2026-10-17 (father/mother names, tribe, region, email …), is rewritten at once to { fullName, referrer, salt }, so
// none of the old fields stay in this browser even if the form is never shown again.
export function loadForm(address: string): CitizenForm {
  const raw = storage.get(formKey(address));
  const fresh = (): CitizenForm => ({ ...EMPTY_FORM, salt: newSalt() });
  if (!raw) return fresh();
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return fresh(); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fresh();
  const o = v as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === 'string' ? x : '');
  const salt = typeof o.salt === 'string' && SALT_RE.test(o.salt) ? o.salt : newSalt();
  const form: CitizenForm = { fullName: text(o.fullName), referrer: text(o.referrer), salt };
  if (salt !== o.salt || Object.keys(o).some((k) => !FORM_KEYS.includes(k))) saveForm(address, form);
  return form;
}
export const saveForm = (address: string, form: CitizenForm): boolean =>
  storage.set(formKey(address), JSON.stringify({ fullName: form.fullName, referrer: form.referrer, salt: form.salt }));

// The short address (cuzdan.pex.network/?ref=X) lands on /i-wallet, not on the citizenship screen: the shell keeps
// the referrer for this browser session so the citizenship form still finds it after create / unlock / home.
const REF_KEY = `${PREFIX}iwallet-ref`;
export function rememberReferrer(ref: string): void {
  try { sessionStorage.setItem(REF_KEY, ref); } catch { /* the field can still be typed */ }
}
export function rememberedReferrer(): string | null {
  try { return sessionStorage.getItem(REF_KEY); } catch { return null; }
}

export type Referrer = { ok: true; value: string | null } | { ok: false; reason: 'invalid' | 'self' };
// Empty means None (the pallet's default referrer). Otherwise it must be a checksummed SS58 address that is not the
// applicant's own account.
export function parseReferrer(text: string, self: string, normalise: (s: string) => string | null): Referrer {
  if (!text.trim()) return { ok: true, value: null };
  const n = normalise(text);
  if (n === null) return { ok: false, reason: 'invalid' };
  if (samePublicKey(n, self)) return { ok: false, reason: 'self' };
  return { ok: true, value: n };
}

export function samePublicKey(a: string, b: string): boolean {
  try { return u8aEq(decodeAddress(a), decodeAddress(b)); } catch { return false; }
}

export type KycStatus = 'NotStarted' | 'PendingReferral' | 'ReferrerApproved' | 'Approved' | 'Revoked';
const KYC: readonly string[] = ['NotStarted', 'PendingReferral', 'ReferrerApproved', 'Approved', 'Revoked'];
// Only known variants map. A variant added by a runtime upgrade surfaces as a load error, as in src/data/citizenship.ts.
export function toKycStatus(type: string): KycStatus {
  if (KYC.includes(type)) return type as KycStatus;
  throw new Error(`unknown citizenship status: ${type}`);
}

export type CitizenStatus = { kyc: KycStatus; nftId: bigint | null };
// kycStatuses is a ValueQuery (NotStarted by default); tiki.citizenNft is an OptionQuery. Measured on mainnet People.
// Why these two and not the spec's applications / userTikis: kycStatuses is the pallet's own state machine and holds all
// five states; applications holds only { identityHash, referrer } (it is read for the referral list, not for status).
// citizenNft is the Welati Tiki NFT id this screen shows; userTikis lists roles and says nothing an applicant needs here.
// The explorer's citizenship card (src/data/citizenship.ts) reads the same two (plus roles and trust for display).
export async function loadStatus(address: string, deps: Deps = real): Promise<CitizenStatus> {
  const api = await deps.getApi('people');
  const q = api.query as never as {
    identityKyc: { kycStatuses(a: string): Promise<{ type: string }> };
    tiki: { citizenNft(a: string): Promise<{ isSome: boolean; unwrap(): { toBigInt(): bigint } }> };
  };
  const [status, nft] = await withTimeout(Promise.all([q.identityKyc.kycStatuses(address), q.tiki.citizenNft(address)]), REQUEST_TIMEOUT_MS);
  return { kyc: toKycStatus(status.type), nftId: nft.isSome ? nft.unwrap().toBigInt() : null };
}

// A citizen NFT is the proof of citizenship: whoever holds one sees the citizen card, never the form, whatever
// kycStatuses says, except Revoked (measured 2026-10-17: all 97 mainnet NFT holders are Approved, so this only guards
// a drift). Being a referrer is the pallet's own rule instead: approve_referral needs kycStatuses == Approved
// (ReferrerNotCitizen), so the referral list is read and offered only then (canRefer).
export const canRefer = (s: CitizenStatus) => s.kyc === 'Approved';
export type Stage = 'form' | 'pending' | 'sign' | 'citizen' | 'approvedNoNft' | 'revoked';
export function stageOf(s: CitizenStatus): Stage {
  // A revoked citizenship wins over a leftover NFT; otherwise an NFT means a citizen whatever the status reads.
  if (s.kyc === 'Revoked') return 'revoked';
  if (s.nftId !== null) return 'citizen';
  switch (s.kyc) {
    case 'NotStarted': return 'form';
    case 'PendingReferral': return 'pending';
    case 'ReferrerApproved': return 'sign';
    case 'Approved': return 'approvedNoNft';
  }
}

// "Wallets you referred" (Serok, 2026-10-17): every account that named this one as referrer, from two sources.
//  - identityKyc.applications: open applications only, { identityHash, referrer }. PendingReferral waits for this
//    account's approve_referral; ReferrerApproved waits for the applicant's confirm_citizenship.
//  - referral.referrals: referred -> { referrer, createdAt (block) }, written by the referral pallet when a citizenship
//    is approved and never removed: not on revoke (on_citizenship_revoked only charges the referrer) and not on
//    renounce_citizenship (live on mainnet: status back to NotStarted, NFT burnt; the person may apply again). Measured
//    on mainnet People 2026-10-17: 97 entries, the same 97 accounts and referrers as identityKyc.citizenReferrers
//    (which has no block number, so it is not read), every one Approved, and per referrer the count equals
//    referral.referralCount.
// So a row says what the person is NOW (kycStatuses + citizenNft), not what the referral map remembers: an open
// application that names this account wins (waiting / signing), otherwise a completed referral is a citizen
// (Approved), revoked (Revoked) or no longer a citizen (renounced, or re-applied under another referrer). The two maps
// are merged by public key. Approve is offered only for an open application that names this account and reads
// PendingReferral, which is exactly what approve_referral accepts.
// Cost: two full-map scans plus one batched status read and one batched NFT read per page view (4 + 97 entries in
// ~0.3 s on 2026-10-17). Move this to the People indexer (SubQuery, keyed by referrer) when referral.referrals passes
// 5,000 entries or the scan takes over 2 s on a phone (docs/deploy.md).
export type ReferralState = 'waiting' | 'signing' | 'citizen' | 'left' | 'revoked';
export type MyReferral = { address: string; state: ReferralState; createdAt: number | null; nftId: bigint | null };
const STATE_ORDER: Record<ReferralState, number> = { waiting: 0, signing: 1, citizen: 2, left: 3, revoked: 4 };
// Waiting for me first, then waiting for their signature, then citizens, then those who left, then revoked; newest
// record first within a group (an unknown record number last), then by address so the order is stable.
export function orderReferrals(list: MyReferral[]): MyReferral[] {
  return [...list].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]
    || (b.createdAt ?? -1) - (a.createdAt ?? -1)
    || (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
}

type Str = { toString(): string };
type Key = { args: [Str] };
type Opt<T> = { isSome?: boolean; unwrap?(): unknown } & Partial<T>;
type AppValue = { identityHash: Str; referrer: Str };
type RefValue = { referrer: Str; createdAt: { toNumber(): number } };
// entries() of an OptionQuery yields Option<T> on some api versions and the struct on others.
function unwrapOpt<T>(v: Opt<T>, has: (x: Partial<T>) => boolean): T | null {
  if (typeof v.isSome === 'boolean') return v.isSome && v.unwrap ? (v.unwrap() as T) : null;
  return has(v) ? (v as T) : null;
}
const pubKey = (a: string): string | null => { try { return u8aToHex(decodeAddress(a)); } catch { return null; } };

export async function myReferrals(address: string, deps: Deps = real): Promise<MyReferral[]> {
  const api = await deps.getApi('people');
  const q = api.query as never as {
    identityKyc: {
      applications: { entries(): Promise<Array<[Key, Opt<AppValue>]>> };
      kycStatuses: { multi(a: string[]): Promise<Array<{ type: string }>> };
    };
    referral: { referrals: { entries(): Promise<Array<[Key, Opt<RefValue>]>> } };
    tiki: { citizenNft: { multi(a: string[]): Promise<Array<{ isSome: boolean; unwrap(): { toBigInt(): bigint } }>> } };
  };
  const me = pubKey(address);
  const isMe = (a: Str) => me !== null && pubKey(a.toString()) === me;
  const [apps, refs] = await withTimeout(Promise.all([q.identityKyc.applications.entries(), q.referral.referrals.entries()]), REQUEST_TIMEOUT_MS);
  // One entry per public key: the address as the chain spells it, the record number of a completed referral, and
  // whether an open application names this account.
  const people = new Map<string, { address: string; createdAt: number | null; open: boolean }>();
  for (const [k, v] of refs) {
    const r = unwrapOpt<RefValue>(v, (x) => !!x.referrer && !!x.createdAt);
    const a = k.args[0].toString(), pk = pubKey(a);
    if (r && pk && isMe(r.referrer)) people.set(pk, { address: a, createdAt: r.createdAt.toNumber(), open: false });
  }
  for (const [k, v] of apps) {
    const app = unwrapOpt<AppValue>(v, (x) => !!x.identityHash && !!x.referrer);
    const a = k.args[0].toString(), pk = pubKey(a);
    if (!app || !pk || !isMe(app.referrer)) continue;
    const known = people.get(pk);
    people.set(pk, known ? { ...known, open: true } : { address: a, createdAt: null, open: true });
  }
  const all = [...people.values()];
  if (all.length === 0) return [];
  const addrs = all.map((p) => p.address);
  const [statuses, nfts] = await withTimeout(Promise.all([q.identityKyc.kycStatuses.multi(addrs), q.tiki.citizenNft.multi(addrs)]), REQUEST_TIMEOUT_MS);
  const list: MyReferral[] = [];
  all.forEach((p, i) => {
    const kyc = toKycStatus(statuses[i].type);
    const nftId = nfts[i].isSome ? nfts[i].unwrap().toBigInt() : null;
    let state: ReferralState | null;
    if (p.open && kyc === 'PendingReferral') state = 'waiting';
    else if (p.open && kyc === 'ReferrerApproved') state = 'signing';
    else if (kyc === 'Approved') state = 'citizen';
    else if (kyc === 'Revoked') state = 'revoked';
    // Once a citizen and no longer one: renounced, or applying again under another referrer.
    else state = p.createdAt !== null ? 'left' : null;
    if (!state) return;
    const completed = state === 'citizen' || state === 'left' || state === 'revoked';
    list.push({ address: p.address, state, createdAt: completed ? p.createdAt : null, nftId: state === 'citizen' ? nftId : null });
  });
  return orderReferrals(list);
}

// Rows shown at first and added by each "Show more" (the founder's list alone held 72 rows on 2026-10-17).
export const REFERRALS_PAGE = 50;

// The link a citizen shares: the short address redirects to /i-wallet with the query kept, and the citizenship form
// fills its referrer field from ?ref= (rememberReferrer above).
export const referralLink = (address: string) => `https://cuzdan.pex.network/?ref=${encodeURIComponent(address)}`;

export const kycDeposit = (people: ApiPromise): bigint =>
  (people.consts as never as { identityKyc: { kycApplicationDeposit: { toBigInt(): bigint } } }).identityKyc.kycApplicationDeposit.toBigInt();

// Spendable HEZ on one chain: shared with Send, so it lives in data.ts.
export { chainSpendable };

const kyc = (api: ApiPromise) => api.tx.identityKyc;
export const buildApply = (people: ApiPromise, hash: string, referrer: string | null): Tx => kyc(people).applyForCitizenship(hash, referrer);
export const buildApprove = (people: ApiPromise, applicant: string): Tx => kyc(people).approveReferral(applicant);
export const buildConfirm = (people: ApiPromise): Tx => kyc(people).confirmCitizenship();
export const buildCancel = (people: ApiPromise): Tx => kyc(people).cancelApplication();

// Pinned against mainnet Asset Hub metadata by scripts/iwallet-live-check.mjs (2026-10-16, spec 1020014):
// VersionedLocation offers V3/V4/V5 and safeXcmVersion is 5; the junction is spelled `Teyrchain`; X1 is a 1-element
// array; and Pezkuwi's limitedTeleportAssets takes the fee asset as a VersionedAssetId (not a u32 index; a bare 0
// encodes as an unused variant and the runtime traps). The dry run of this exact shape lands the HEZ on People.
export const XCM_VERSION = 'V5';
export const TELEPORT_EXTRA = 500_000_000_000n; // 0.5 HEZ on top of the deposit, for fees on People (spec §6)
export const teleportAmount = (deposit: bigint) => deposit + TELEPORT_EXTRA;

export function teleportArgs(address: string, amount: bigint) {
  const here = { parents: 1, interior: 'Here' };
  return [
    { [XCM_VERSION]: { parents: 1, interior: { X1: [{ Teyrchain: IWALLET_NETWORK.xcm.peopleParaId }] } } },
    { [XCM_VERSION]: { parents: 0, interior: { X1: [{ AccountId32: { network: null, id: u8aToHex(decodeAddress(address)) } }] } } },
    { [XCM_VERSION]: [{ id: here, fun: { Fungible: amount } }] },
    { [XCM_VERSION]: here },
    'Unlimited',
  ] as const;
}
export function buildTeleportToPeople(assetHub: ApiPromise, address: string, amount: bigint): Tx {
  return assetHub.tx.pezkuwiXcm.limitedTeleportAssets(...teleportArgs(address, amount));
}

// Asset Hub must also pay the XCM delivery fee, which paymentInfo does not include. Measured on mainnet 2026-10-16 by
// the dry run in scripts/iwallet-live-check.mjs: 103,299,966 TYR (~0.0001 HEZ). The screen cannot dry-run cheaply, so it
// keeps a fixed allowance of 0.001 HEZ (about 10x the measured fee) so a balance just at the edge is not offered a
// teleport that fails on chain.
export const DELIVERY_FEE_ALLOWANCE = 1_000_000_000n;
export const assetHubNeed = (amount: bigint, txFee: bigint, ed: bigint): bigint => amount + txFee + DELIVERY_FEE_ALLOWANCE + ed;

// People needs the deposit, the apply fee and the existential deposit left over.
export const needsFunding = (peopleFree: bigint, deposit: bigint, fee: bigint, ed: bigint): boolean => peopleFree < deposit + fee + ed;

// After a teleport the People balance is polled this often, for this long (spec §6 / global review focus 5).
// Mutable only so tests can shorten it.
export const FUNDING_POLL = { everyMs: 6_000, forMs: 120_000 };

// A teleport that may still be landing is remembered for this browser session, per address, so leaving the screen
// (or an auto-lock) cannot bring the teleport button back and invite a second one. For this long after sending, the
// screen offers only "check again"; after it, a teleport that never arrived can be sent again.
export const TELEPORT_GUARD_MS = 5 * 60_000;
export function teleportSentAt(address: string): number | null {
  try {
    const n = Number(sessionStorage.getItem(teleportKey(address)) ?? NaN);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
export function markTeleportSent(address: string, at: number = Date.now()): void {
  try { sessionStorage.setItem(teleportKey(address), String(at)); } catch { /* the in-page guard still holds */ }
}
export function teleportGuardActive(address: string, now: number = Date.now()): boolean {
  const at = teleportSentAt(address);
  return at !== null && now >= at && now - at < TELEPORT_GUARD_MS;
}

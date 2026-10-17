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
};

export const EMPTY_FORM: CitizenForm = { fullName: '', referrer: '' };

// The on-chain identity hash. The field set shrank with the form (2026-10-17): it was pwap NewCitizenApplication.tsx's
// nine-field recipe and now hashes { fullName, walletAddress } only, so it no longer matches pwap's hash for the same
// person. Uniqueness comes from the wallet address (one application per account); the name is hashed as typed.
export function identityHash(form: CitizenForm, address: string): string {
  return blake2AsHex(JSON.stringify({ fullName: form.fullName, walletAddress: address }), 256);
}

export type FormProblem = 'fullName';
export function formProblems(form: CitizenForm): FormProblem[] {
  return form.fullName.trim() ? [] : ['fullName'];
}

// Personal data is kept only in this browser's localStorage (via src/lib/storage.ts), keyed by the wallet address.
export const formKey = (address: string) => `iwallet-citizen:${address}`;
export function loadForm(address: string): CitizenForm {
  const raw = storage.get(formKey(address));
  if (!raw) return { ...EMPTY_FORM };
  try {
    // A form saved before 2026-10-17 also holds father/mother names, tribe, region, email and so on: only the two
    // fields the form still has are kept, and the next save drops the rest from this browser.
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    const text = (x: unknown) => (typeof x === 'string' ? x : '');
    return v && typeof v === 'object' ? { fullName: text(v.fullName), referrer: text(v.referrer) } : { ...EMPTY_FORM };
  } catch { return { ...EMPTY_FORM }; }
}
export const saveForm = (address: string, form: CitizenForm): boolean =>
  storage.set(formKey(address), JSON.stringify({ fullName: form.fullName, referrer: form.referrer }));
export const clearForm = (address: string): void => storage.remove(formKey(address));
// "Delete from device" promises a clean device: every saved citizenship form goes, whatever wallet it belonged to.
export function clearAllForms(): void {
  const prefix = PREFIX + formKey('');
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch { /* storage unavailable: nothing was kept */ }
}

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
// The explorer's Zagros citizenship card (src/data/citizenship.ts) reads the same two (plus roles and trust for display).
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
// kycStatuses says (measured 2026-10-17: all 97 mainnet NFT holders are Approved, so this only guards a drift).
export const isCitizen = (s: CitizenStatus) => s.nftId !== null || s.kyc === 'Approved';
export type Stage = 'form' | 'pending' | 'sign' | 'citizen' | 'approvedNoNft' | 'revoked';
export function stageOf(s: CitizenStatus): Stage {
  if (s.nftId !== null) return 'citizen';
  switch (s.kyc) {
    case 'NotStarted': return 'form';
    case 'PendingReferral': return 'pending';
    case 'ReferrerApproved': return 'sign';
    case 'Approved': return 'approvedNoNft';
    case 'Revoked': return 'revoked';
  }
}

export type PendingReferral = { applicant: string; identityHash: string };
// Applications that name this account as referrer and still wait for its approval (pwap getPendingApprovalsForReferrer).
// The applications struct is { identityHash, referrer } with the referrer always set (the pallet fills its default).
// Only citizens can be referrers (ReferrerNotCitizen), so callers run this only for an Approved account. The statuses of
// the matching applicants are read in one batched query.
export async function pendingReferrals(address: string, deps: Deps = real): Promise<PendingReferral[]> {
  const api = await deps.getApi('people');
  const q = api.query as never as {
    identityKyc: {
      applications: { entries(): Promise<Array<[{ args: [{ toString(): string }] }, { isSome?: boolean; unwrap?(): unknown } & AppValue]>> };
      kycStatuses: { multi(a: string[]): Promise<Array<{ type: string }>> };
    };
  };
  const entries = await withTimeout(q.identityKyc.applications.entries(), REQUEST_TIMEOUT_MS);
  const mine = entries
    .map(([k, v]) => ({ applicant: k.args[0].toString(), app: unwrapApp(v) }))
    .filter((e) => e.app !== null && samePublicKey(e.app.referrer.toString(), address));
  if (mine.length === 0) return [];
  const statuses = await withTimeout(q.identityKyc.kycStatuses.multi(mine.map((e) => e.applicant)), REQUEST_TIMEOUT_MS);
  return mine
    .filter((_, i) => statuses[i].type === 'PendingReferral')
    .map((e) => ({ applicant: e.applicant, identityHash: e.app!.identityHash.toString() }));
}
type AppValue = { identityHash: { toString(): string }; referrer: { toString(): string } };
function unwrapApp(v: { isSome?: boolean; unwrap?(): unknown } & Partial<AppValue>): AppValue | null {
  // entries() of an OptionQuery yields Option<Application> on some api versions and the struct on others.
  if (typeof v.isSome === 'boolean') return v.isSome && v.unwrap ? (v.unwrap() as AppValue) : null;
  return v.identityHash && v.referrer ? (v as AppValue) : null;
}

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
const teleportKey = (address: string) => `${PREFIX}iwallet-teleport:${address}`;
export function teleportSentAt(address: string): number | null {
  try {
    const n = Number(sessionStorage.getItem(teleportKey(address)) ?? NaN);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
export function markTeleportSent(address: string, at: number = Date.now()): void {
  try { sessionStorage.setItem(teleportKey(address), String(at)); } catch { /* the in-page guard still holds */ }
}
export function clearTeleportSent(address: string): void {
  try { sessionStorage.removeItem(teleportKey(address)); } catch { /* nothing to remove */ }
}
export function teleportGuardActive(address: string, now: number = Date.now()): boolean {
  const at = teleportSentAt(address);
  return at !== null && now >= at && now - at < TELEPORT_GUARD_MS;
}

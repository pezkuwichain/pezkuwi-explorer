import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import type { ISubmittableResult } from '@pezkuwi/types/types';
import type { DispatchError } from '@pezkuwi/types/interfaces';
import type { KeyringPair } from '@pezkuwi/keyring/types';
import { IWALLET_NETWORK } from '../config/iwallet-network';
import { ERROR_KEYS } from './errors';

export type SendToken = 'HEZ' | 'PEZ' | 'USDT';
export const SEND_TOKENS: readonly SendToken[] = ['HEZ', 'PEZ', 'USDT'];

// Per-token facts, read from the network config so a genesis reset changes one file.
export function tokenInfo(token: SendToken): { symbol: SendToken; decimals: number; assetId: number | null } {
  if (token === 'HEZ') return { symbol: 'HEZ', decimals: IWALLET_NETWORK.native.decimals, assetId: null };
  const a = IWALLET_NETWORK.assets.find((x) => x.symbol === token)!;
  return { symbol: token, decimals: a.decimals, assetId: a.id };
}

// Sending more than this many HEZ from the browser hot wallet needs an explicit acknowledgement (spec §5).
// It applies to HEZ only: PEZ and USDT are never gated.
export const LARGE_HEZ = 1000n * 10n ** 12n;
export const needsLargeAck = (token: SendToken, amount: bigint | null): boolean =>
  token === 'HEZ' && amount !== null && amount > LARGE_HEZ;

type Tx = SubmittableExtrinsic<'promise'>;

// HEZ moves with transferKeepAlive (the sender can never be reaped); PEZ and USDT are Asset Hub assets.
export function buildTransfer(api: ApiPromise, token: SendToken, to: string, amount: bigint): Tx {
  const { assetId } = tokenInfo(token);
  return assetId === null
    ? api.tx.balances.transferKeepAlive(to, amount)
    : api.tx.assets.transfer(assetId, to, amount);
}

// null when the node cannot price the call: the screen then shows "—" instead of a made-up number.
export async function estimateFee(tx: Tx, address: string): Promise<bigint | null> {
  try { return (await tx.paymentInfo(address)).partialFee.toBigInt(); } catch { return null; }
}

// HEZ: what is left after the fee and the existential deposit (transferKeepAlive keeps the account alive), floored at 0.
// Assets: the whole asset balance (the fee is paid in HEZ).
export function maxSendable(free: bigint, fee: bigint, ed: bigint, token: SendToken): bigint {
  if (token !== 'HEZ') return free;
  const left = free - fee - ed;
  return left > 0n ? left : 0n;
}

export type SubmitEvent =
  | { type: 'submitted' }
  | { type: 'inBlock'; blockHash: string }
  | { type: 'finalized'; blockHash: string; extrinsicHash: string }
  | { type: 'failed'; dispatchError: DispatchError }
  | { type: 'dropped' }
  // Finalized, but system.ExtrinsicSuccess could not be found in this extrinsic's events: the result is unknown.
  | { type: 'unknown' }
  // The node gave up waiting for finality; the extrinsic may still be finalized later.
  | { type: 'slow'; inBlock: boolean };

const hasSuccess = (r: ISubmittableResult): boolean =>
  !r.internalError && r.events.some(({ event }) => event.section === 'system' && event.method === 'ExtrinsicSuccess');

// A refusal by the node's transaction pool that proves the transaction was NOT accepted: 1010 invalid, 1011 cannot
// lookup, 1014 priority too low. Others in that range (1012 temporarily banned, 1013 already imported) can mean the
// transaction is, or was, in the pool; any other rejection after hand-off (socket closed, timeout) is unknown too.
const REFUSAL_CODES = new Set([1010, 1011, 1014]);
export function isNodeRefusal(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'number' && REFUSAL_CODES.has(code)) return true;
  const m = /^\s*(10\d\d):/.exec(String((e as { message?: unknown } | null)?.message ?? ''));
  return m !== null && REFUSAL_CODES.has(Number(m[1]));
}

// Signs, locks the pair, then sends. Resolves after a terminal event; rejects if signing fails (before anything left
// this device) or if the send call rejects. 'submitted' is reported just BEFORE the extrinsic is handed to the node,
// so a caller knows that any later rejection may hide a transaction that is already in the pool.
// `stop` ends the status subscription early (the caller gave up waiting, e.g. the connection dropped).
export async function submit(tx: Tx, pair: KeyringPair, onStatus: (e: SubmitEvent) => void, stop?: AbortSignal): Promise<void> {
  // The secret key is needed only to sign: wipe it before the (possibly long) wait for finality.
  try { await tx.signAsync(pair, { nonce: -1 }); } finally { try { pair.lock(); } catch { /* already locked */ } }
  return new Promise<void>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    let done = false;
    let seenInBlock = false;
    const finish = () => { done = true; unsub?.(); resolve(); };
    if (stop) {
      if (stop.aborted) { done = true; } else stop.addEventListener('abort', () => { done = true; unsub?.(); resolve(); }, { once: true });
    }
    const handle = (r: ISubmittableResult) => {
      if (done) return;
      if (r.dispatchError) { onStatus({ type: 'failed', dispatchError: r.dispatchError }); finish(); return; }
      const s = r.status;
      if (s.isInBlock) { seenInBlock = true; onStatus({ type: 'inBlock', blockHash: s.asInBlock.toHex() }); }
      else if (s.isFinalized) {
        if (hasSuccess(r)) onStatus({ type: 'finalized', blockHash: s.asFinalized.toHex(), extrinsicHash: r.txHash.toHex() });
        else onStatus({ type: 'unknown' });
        finish();
      } else if (s.isFinalityTimeout) { onStatus({ type: 'slow', inBlock: seenInBlock }); finish(); }
      else if (s.isDropped || s.isInvalid || s.isUsurped) { onStatus({ type: 'dropped' }); finish(); }
    };
    onStatus({ type: 'submitted' });
    tx.send(handle).then(
      (u) => { unsub = u as () => void; if (done) unsub(); },
      (e: unknown) => { done = true; reject(e); },
    );
  });
}

// The text a person reads for a failed extrinsic. Known pallet errors have their own wording; an unknown module error
// names itself; anything that is not a module error is the generic message.
export function friendlyError(api: ApiPromise, dispatchError: DispatchError, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!dispatchError.isModule) return t('iwallet.error.generic');
  let name: string;
  try {
    const m = api.registry.findMetaError(dispatchError.asModule);
    name = `${m.section}.${m.name}`;
  } catch { return t('iwallet.error.generic'); }
  const key = ERROR_KEYS[name];
  return key ? t(key) : t('iwallet.send.failedNamed', { name });
}

import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import type { ISubmittableResult } from '@pezkuwi/types/types';
import type { DispatchError, EventRecord } from '@pezkuwi/types/interfaces';
import type { KeyringPair } from '@pezkuwi/keyring/types';
import { IWALLET_NETWORK } from '../config/iwallet-network';
import type { ChainKey } from '../config/network';
import { ERROR_KEYS } from './errors';

export type SendToken = 'HEZ' | 'PEZ' | 'USDT';
export const SEND_TOKENS: readonly SendToken[] = ['HEZ', 'PEZ', 'USDT'];

// Per-token facts, read from the network config so a genesis reset changes one file.
export function tokenInfo(token: SendToken): { symbol: SendToken; decimals: number; assetId: number | null } {
  if (token === 'HEZ') return { symbol: 'HEZ', decimals: IWALLET_NETWORK.native.decimals, assetId: null };
  const a = IWALLET_NETWORK.assets.find((x) => x.symbol === token)!;
  return { symbol: token, decimals: a.decimals, assetId: a.id };
}

// The network a transfer of `token` is made on: HEZ on the one the person chose, PEZ and USDT always on Asset Hub
// (People has an assets pallet too, so a stray choice must never route an asset there).
export const sendChain = (token: SendToken, chosen: ChainKey): ChainKey => (tokenInfo(token).assetId === null ? chosen : 'assetHub');

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
  // `likelyFailed`: the block's events carry a dispatch error for it. Not final: the block may still be retracted and
  // the extrinsic included again with another result, so only finality decides.
  | { type: 'inBlock'; blockHash: string; likelyFailed?: true }
  | { type: 'finalized'; blockHash: string; extrinsicHash: string }
  | { type: 'failed'; dispatchError: DispatchError }
  | { type: 'dropped' }
  // The result is unknown: finalized without system.ExtrinsicSuccess in this extrinsic's events, or dropped by the
  // node's pool (possibly after it was gossiped or seen in a block).
  | { type: 'unknown' }
  // Finality is slow. With inBlock it is reported once and the wait goes on (bounded, FINALITY_GIVE_UP_MS); without a
  // block it is final (nothing seen of it within SEND_WAIT_MS, or the node gave up): it may still complete.
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

// What the finality watcher reads from the chain (see finalityReader). Each call may reject; the watcher then tries
// again on its next tick.
export interface FinalityReader {
  /** The block number of the node's finalized head. */
  finalizedNumber(): Promise<number>;
  /** The number of the block with this hash. */
  blockNumber(blockHash: string): Promise<number>;
  /** The canonical (best-chain) block hash at this number. */
  canonicalHash(n: number): Promise<string>;
  /** How the extrinsic with this hash fared in that block, from the block's own events. */
  extrinsicResult(blockHash: string, extrinsicHash: string): Promise<
    { kind: 'success' } | { kind: 'failed'; dispatchError: DispatchError } | { kind: 'unknown' }
  >;
}

export function finalityReader(api: ApiPromise): FinalityReader {
  return {
    finalizedNumber: async () => (await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead())).number.toNumber(),
    blockNumber: async (h) => (await api.rpc.chain.getHeader(h)).number.toNumber(),
    canonicalHash: async (n) => (await api.rpc.chain.getBlockHash(n)).toHex(),
    extrinsicResult: async (blockHash, extrinsicHash) => {
      const [signed, at] = await Promise.all([api.rpc.chain.getBlock(blockHash), api.at(blockHash)]);
      const index = signed.block.extrinsics.findIndex((x) => x.hash.toHex() === extrinsicHash);
      if (index < 0) return { kind: 'unknown' };
      const records = (await at.query.system.events()) as unknown as EventRecord[];
      for (const { phase, event } of records) {
        if (!phase.isApplyExtrinsic || phase.asApplyExtrinsic.toNumber() !== index || event.section !== 'system') continue;
        if (event.method === 'ExtrinsicSuccess') return { kind: 'success' };
        if (event.method === 'ExtrinsicFailed') return { kind: 'failed', dispatchError: event.data[0] as DispatchError };
      }
      return { kind: 'unknown' };
    },
  };
}

/** How often the finality watcher reads the finalized head once the extrinsic is in a block. */
export const FINALITY_POLL_MS = 6_000;
/** After the hand-off, how long to wait for a first block before saying it may still complete. */
export const SEND_WAIT_MS = 120_000;
/** After the first block, how long to wait for finality before saying it is slow (the wait goes on). */
export const FINALITY_WAIT_MS = 180_000;
/** After the first block, when to stop waiting altogether; well inside the ~256 blocks of state the nodes keep. */
export const FINALITY_GIVE_UP_MS = 900_000;

// Signs, locks the pair, then sends. Resolves once nothing more will be reported; rejects if signing fails (before
// anything left this device) or if the send call rejects. 'submitted' is reported just BEFORE the extrinsic is handed
// to the node, so a caller knows that any later rejection may hide a transaction that is already in the pool.
// `stop` ends the wait early (the caller gave up waiting, e.g. the connection dropped, or the screen went away). If it
// is set before the hand-off, nothing is sent: it resolves without 'submitted'.
// With `chain`, finality is also confirmed from the chain itself once the extrinsic is in a block: the status
// subscription can go quiet (a socket that reconnects silently drops it) and would then wait for the node's own
// finality timeout, hundreds of blocks later. Whichever reports first wins; the other is stopped.
export async function submit(
  tx: Tx, pair: KeyringPair, onStatus: (e: SubmitEvent) => void, stop?: AbortSignal, chain?: FinalityReader,
): Promise<void> {
  // The secret key is needed only to sign: wipe it before the (possibly long) wait for finality.
  try { await tx.signAsync(pair, { nonce: -1 }); } finally { try { pair.lock(); } catch { /* already locked */ } }
  // The last moment to give up: nothing has left this device yet.
  if (stop?.aborted) return;
  return new Promise<void>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    let done = false;
    let seenInBlock = false;
    let saidSlow = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let firstBlock: ReturnType<typeof setTimeout> | undefined;
    // The block the watcher waits on; null after a retraction until the next inBlock.
    let target: { hash: string; extrinsicHash: string; n: number | null } | null = null;
    const clear = () => { done = true; clearInterval(poll); clearTimeout(firstBlock); timers.forEach(clearTimeout); unsub?.(); };
    const finish = () => { clear(); resolve(); };
    // One terminal report, whoever makes it.
    const end = (e: SubmitEvent) => { if (done) return; onStatus(e); finish(); };
    // Slow, but still watched: the screen moves on if the answer comes later.
    const slow = () => { if (!done && !saidSlow) { saidSlow = true; onStatus({ type: 'slow', inBlock: true }); } };
    stop?.addEventListener('abort', () => { if (!done) finish(); }, { once: true });
    let reading = false;
    const check = async () => {
      const at = target;
      if (done || reading || !chain || !at) return;
      reading = true;
      try {
        if (at.n === null) at.n = await chain.blockNumber(at.hash);
        const finalized = await chain.finalizedNumber();
        if (done || target !== at || finalized < at.n) return;
        // Finalized past it, but another block is canonical there: this one was retracted. Wait for a new inBlock.
        if ((await chain.canonicalHash(at.n)) !== at.hash) { if (target === at) target = null; return; }
        if (done || target !== at) return;
        const r = await chain.extrinsicResult(at.hash, at.extrinsicHash);
        if (target !== at) return;
        if (r.kind === 'success') end({ type: 'finalized', blockHash: at.hash, extrinsicHash: at.extrinsicHash });
        else if (r.kind === 'failed') end({ type: 'failed', dispatchError: r.dispatchError });
        else end({ type: 'unknown' });
      } catch { /* a failed read: try again on the next tick */ } finally { reading = false; }
    };
    const onInBlock = (hash: string, extrinsicHash: string) => {
      target = { hash, extrinsicHash, n: null };
      if (seenInBlock) return;
      seenInBlock = true;
      clearTimeout(firstBlock);
      timers.push(setTimeout(slow, FINALITY_WAIT_MS), setTimeout(finish, FINALITY_GIVE_UP_MS));
      if (chain) poll = setInterval(() => { void check(); }, FINALITY_POLL_MS);
    };
    const handle = (r: ISubmittableResult) => {
      if (done) return;
      const s = r.status;
      if (s.isInBlock) {
        const blockHash = s.asInBlock.toHex();
        onInBlock(blockHash, r.txHash.toHex());
        onStatus(r.dispatchError ? { type: 'inBlock', blockHash, likelyFailed: true } : { type: 'inBlock', blockHash });
      } else if (s.isRetracted) target = null; // its block left the best chain; a new inBlock follows
      else if (s.isFinalized) {
        if (r.dispatchError) end({ type: 'failed', dispatchError: r.dispatchError });
        else end(hasSuccess(r) ? { type: 'finalized', blockHash: s.asFinalized.toHex(), extrinsicHash: r.txHash.toHex() } : { type: 'unknown' });
      } else if (s.isFinalityTimeout) {
        // The node stopped watching. After a block the chain itself can still be read; without one it may still complete.
        if (!seenInBlock) end({ type: 'slow', inBlock: false });
        else { slow(); if (!chain) finish(); }
      } else if (s.isDropped || s.isInvalid || s.isUsurped) {
        // Only Invalid / Usurped before any block prove nothing will be included. Dropped means just that this node's
        // pool let it go (it may already have been gossiped), and after a block any of the three leaves it unknown.
        end(seenInBlock || s.isDropped ? { type: 'unknown' } : { type: 'dropped' });
      }
    };
    // No block within SEND_WAIT_MS of the hand-off (a subscription gone quiet before inclusion): it may still complete.
    firstBlock = setTimeout(() => end({ type: 'slow', inBlock: false }), SEND_WAIT_MS);
    onStatus({ type: 'submitted' });
    tx.send(handle).then(
      (u) => { unsub = u as () => void; if (done) unsub(); },
      (e: unknown) => { if (done) return; clear(); reject(e); },
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

import { NETWORK } from '../config/network';
import { normaliseAddress } from '../lib/address';
import { withTimeout } from '../lib/timeout';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';

export class NotIndexedError extends Error {}
// The input is neither a transaction code nor a valid address.
export class InvalidLookupError extends Error {}
export type Activity = {
  id: string; when: number; direction: 'sent' | 'received' | 'other'; counterparty: string | null;
  // null = asset not in NETWORK.assets: consumers must NOT format an amount when decimals is null.
  symbol: string; decimals: number | null; amount: bigint; fee: bigint; ok: boolean; code: string | null;
};
type Node = {
  id: string; extrinsicHash: string | null; timestamp: string; address: string;
  transfer: { from: string; to: string; amount: string; fee: string; success: boolean } | null;
  assetTransfer: { assetId: string; from: string; to: string; amount: string; fee: string; success: boolean } | null;
  extrinsic: { fee: string; success: boolean } | null;
};
// transfer/assetTransfer/extrinsic are JSON scalars on this schema (no sub-selection).
const FIELDS = 'id extrinsicHash timestamp address transfer assetTransfer extrinsic';

// Remote input is untrusted: a node with any malformed field is dropped here so it can never throw (or yield NaN) downstream.
const isStr = (v: unknown): v is string => typeof v === 'string';
const isUint = (v: unknown) => isStr(v) && /^\d+$/.test(v);
function validTransfer(t: unknown, asset: boolean): boolean {
  if (typeof t !== 'object' || t === null) return false;
  const o = t as Record<string, unknown>;
  return isStr(o.from) && isStr(o.to) && isUint(o.amount) && isUint(o.fee) && typeof o.success === 'boolean' &&
    (!asset || isStr(o.assetId) || typeof o.assetId === 'number');
}
function validNode(n: unknown): n is Node {
  if (typeof n !== 'object' || n === null) return false;
  const o = n as Record<string, unknown>;
  const ts = typeof o.timestamp === 'number' ? o.timestamp : isUint(o.timestamp) ? Number(o.timestamp) : NaN;
  if (!isStr(o.id) || !isStr(o.address) || !Number.isSafeInteger(ts) || ts < 0) return false;
  if (o.extrinsicHash !== null && o.extrinsicHash !== undefined && !isStr(o.extrinsicHash)) return false;
  if (o.transfer != null && !validTransfer(o.transfer, false)) return false;
  if (o.assetTransfer != null && !validTransfer(o.assetTransfer, true)) return false;
  if (o.extrinsic != null) {
    const e = o.extrinsic as Record<string, unknown>;
    if (typeof e !== 'object' || !isUint(e.fee) || typeof e.success !== 'boolean') return false;
  }
  return true;
}

async function query(filter: string, fetcher: typeof fetch): Promise<Node[]> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const body = JSON.stringify({ query: `{historyElements(first:25,orderBy:TIMESTAMP_DESC,filter:${filter}){nodes{${FIELDS}}}}` });
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }), REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(`history ${res.status}`);
  const nodes = (await res.json())?.data?.historyElements?.nodes;
  if (!Array.isArray(nodes)) throw new Error('history: malformed indexer response');
  return nodes.filter(validNode);
}

// The indexer's extrinsicHash is shown to people as the transaction code: only 0x + 64 hex digits is one.
export const CODE_RE = /^0x[0-9a-fA-F]{64}$/;
export const validCode = (v: unknown): string | null => (typeof v === 'string' && CODE_RE.test(v) ? v.toLowerCase() : null);

// Two addresses are the same account only when both are readable; two unreadable ones are not equal.
function sameAccount(a: string, b: string | null): boolean {
  const x = normaliseAddress(a);
  return x !== null && b !== null && x === b;
}

function toActivity(n: Node, me: string): Activity {
  const t = n.transfer ?? n.assetTransfer;
  const asset = n.assetTransfer ? NETWORK.assets.find((a) => String(a.id) === String(n.assetTransfer!.assetId)) : null;
  const symbol = asset?.symbol ?? (n.assetTransfer ? `#${n.assetTransfer.assetId}` : NETWORK.native.symbol);
  const decimals = n.assetTransfer ? (asset?.decimals ?? null) : NETWORK.native.decimals;
  const code = validCode(n.extrinsicHash);
  if (!t) {
    return { id: n.id, when: Number(n.timestamp), direction: 'other', counterparty: null, symbol, decimals, amount: 0n,
      fee: BigInt(n.extrinsic?.fee ?? '0'), ok: n.extrinsic?.success ?? true, code };
  }
  const meN = normaliseAddress(me);
  const direction = sameAccount(t.from, meN) ? 'sent' : sameAccount(t.to, meN) ? 'received' : 'other';
  const counterparty = direction === 'sent' ? t.to : direction === 'received' ? t.from : null;
  return { id: n.id, when: Number(n.timestamp), direction, counterparty,
    symbol, decimals, amount: BigInt(t.amount), fee: BigInt(t.fee), ok: t.success, code };
}

export async function loadActivity(address: string, fetcher: typeof fetch = fetch): Promise<Activity[]> {
  return (await query(`{address:{equalTo:${JSON.stringify(address)}}}`, fetcher)).map((n) => toActivity(n, address));
}

// Event index inside the block, parsed from ids like `<blk>-<idx>-from` / `-to`; null when it is not a plain number.
const eventIdx = (n: Node): number | null => {
  const s = n.id.split('-')[1];
  return s !== undefined && /^\d+$/.test(s) ? Number(s) : null;
};
// Total order: numeric index first (ascending), non-numeric last; then the -from node of a pair; then the id itself.
function byEvent(a: Node, b: Node): number {
  const ia = eventIdx(a), ib = eventIdx(b);
  if (ia !== ib) return ia === null ? 1 : ib === null ? -1 : ia - ib;
  const fa = a.id.endsWith('-from'), fb = b.id.endsWith('-from');
  if (fa !== fb) return fa ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
// The two nodes of one transfer (`-from` and `-to`) are the same event.
const eventKey = (n: Node) => n.id.replace(/-(from|to)$/, '');
function firstOfEachEvent(sorted: Node[]): Node[] {
  const seen = new Set<string>();
  return sorted.filter((n) => {
    const k = eventKey(n);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// How many recent transfers an address lookup shows.
export const RECENT_LIMIT = 5;

export type PaymentLookup =
  | { status: 'notFound' }
  // A transaction code: one entry per transfer it made (a batch makes several), each from the sender's side.
  | { kind: 'code'; status: 'arrived' | 'failed' | 'partial' | 'notAPayment'; transfers: Activity[] }
  // An address: its most recent transfers, each relative to that address. No single verdict: the newest
  // transfer touching an address need not be the payment the person is asking about.
  | { kind: 'address'; status: 'recent'; address: string; transfers: Activity[] };

export async function findPayment(input: string, fetcher: typeof fetch = fetch): Promise<PaymentLookup> {
  const text = input.trim();
  if (CODE_RE.test(text)) {
    const nodes = await query(`{extrinsicHash:{equalTo:${JSON.stringify(text.toLowerCase())}}}`, fetcher);
    if (nodes.length === 0) return { status: 'notFound' };
    const transfers = firstOfEachEvent(nodes.filter((n) => n.transfer || n.assetTransfer).sort(byEvent))
      // Always the sender's perspective, so the answer does not depend on which node of a pair came first.
      .map((n) => toActivity(n, (n.transfer ?? n.assetTransfer)!.from));
    if (transfers.length === 0) {
      const ex = nodes.find((n) => n.extrinsic) ?? nodes[0];
      const ok = ex.extrinsic?.success ?? true;
      return { kind: 'code', status: ok ? 'notAPayment' : 'failed', transfers: [] };
    }
    const okCount = transfers.filter((a) => a.ok).length;
    const status = okCount === transfers.length ? 'arrived' : okCount === 0 ? 'failed' : 'partial';
    return { kind: 'code', status, transfers };
  }
  const a = normaliseAddress(text);
  if (!a) throw new InvalidLookupError('not a code or address');
  const transfers = (await query(`{address:{equalTo:${JSON.stringify(a)}}}`, fetcher))
    .filter((x) => x.transfer || x.assetTransfer)
    .slice(0, RECENT_LIMIT)
    .map((n) => toActivity(n, a));
  if (transfers.length === 0) return { status: 'notFound' };
  return { kind: 'address', status: 'recent', address: a, transfers };
}

export async function indexerLag(fetcher: typeof fetch = fetch): Promise<number> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{_metadata{lastProcessedHeight targetHeight}}' }) }), REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(`history ${res.status}`);
  const m = (await res.json())?.data?._metadata;
  if (!Number.isFinite(m?.targetHeight) || !Number.isFinite(m?.lastProcessedHeight)) throw new Error('history: malformed indexer metadata');
  return m.targetHeight - m.lastProcessedHeight;
}

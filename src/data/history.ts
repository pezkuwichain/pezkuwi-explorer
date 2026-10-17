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
  // A transaction that moved no funds (staking.bond, revive.call, ...): its pallet and call, shown instead of an
  // amount. null for a transfer, or when the indexer gave no readable name.
  call: string | null;
};
type Node = {
  id: string; extrinsicHash: string | null; timestamp: string; address: string;
  transfer: { from: string; to: string; amount: string; fee: string; success: boolean } | null;
  assetTransfer: { assetId: string; from: string; to: string; amount: string; fee: string; success: boolean } | null;
  extrinsic: { fee: string; success: boolean; module?: unknown; call?: unknown } | null;
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

// `returned` is how many nodes the indexer sent, before malformed ones were dropped. `next` is the cursor of the
// following page when the indexer says there is one; null when it says there is none; undefined when it gave no
// page info (then a page as long as `first` has to be read as "there may be more").
type Page = { nodes: Node[]; returned: number; next: string | null | undefined };
async function query(filter: string, fetcher: typeof fetch, first = 25, page?: { orderBy: string; after: string | null }): Promise<Page> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const order = page ? page.orderBy : 'TIMESTAMP_DESC';
  const after = page?.after ? `,after:${JSON.stringify(page.after)}` : '';
  const info = page ? ' pageInfo{hasNextPage endCursor}' : '';
  const body = JSON.stringify({ query: `{historyElements(first:${first},orderBy:${order}${after},filter:${filter}){nodes{${FIELDS}}${info}}}` });
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }), REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(`history ${res.status}`);
  const conn = (await res.json())?.data?.historyElements;
  const nodes = conn?.nodes;
  if (!Array.isArray(nodes)) throw new Error('history: malformed indexer response');
  const pi = conn?.pageInfo;
  const next = pi && typeof pi.hasNextPage === 'boolean'
    ? (pi.hasNextPage ? (typeof pi.endCursor === 'string' && pi.endCursor ? pi.endCursor : undefined) : null)
    : undefined;
  return { nodes: nodes.filter(validNode), returned: nodes.length, next };
}

// The indexer's extrinsicHash is shown to people as the transaction code: only 0x + 64 hex digits is one.
export const CODE_RE = /^0x[0-9a-fA-F]{64}$/;
export const validCode = (v: unknown): string | null => (typeof v === 'string' && CODE_RE.test(v) ? v.toLowerCase() : null);

// Two addresses are the same account only when both are readable; two unreadable ones are not equal.
function sameAccount(a: string, b: string | null): boolean {
  const x = normaliseAddress(a);
  return x !== null && b !== null && x === b;
}

// A pallet or call name as the indexer gives it; anything else is not shown.
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const callName = (e: Node['extrinsic']): string | null =>
  e && typeof e.module === 'string' && typeof e.call === 'string' && NAME_RE.test(e.module) && NAME_RE.test(e.call) ? `${e.module}.${e.call}` : null;

function toActivity(n: Node, me: string): Activity {
  const t = n.transfer ?? n.assetTransfer;
  const asset = n.assetTransfer ? NETWORK.assets.find((a) => String(a.id) === String(n.assetTransfer!.assetId)) : null;
  const symbol = asset?.symbol ?? (n.assetTransfer ? `#${n.assetTransfer.assetId}` : NETWORK.native.symbol);
  const decimals = n.assetTransfer ? (asset?.decimals ?? null) : NETWORK.native.decimals;
  const code = validCode(n.extrinsicHash);
  if (!t) {
    return { id: n.id, when: Number(n.timestamp), direction: 'other', counterparty: null, symbol, decimals, amount: 0n,
      fee: BigInt(n.extrinsic?.fee ?? '0'), ok: n.extrinsic?.success ?? true, code, call: callName(n.extrinsic) };
  }
  const meN = normaliseAddress(me);
  const direction = sameAccount(t.from, meN) ? 'sent' : sameAccount(t.to, meN) ? 'received' : 'other';
  const counterparty = direction === 'sent' ? t.to : direction === 'received' ? t.from : null;
  return { id: n.id, when: Number(n.timestamp), direction, counterparty,
    symbol, decimals, amount: BigInt(t.amount), fee: BigInt(t.fee), ok: t.success, code, call: null };
}

export async function loadActivity(address: string, fetcher: typeof fetch = fetch): Promise<Activity[]> {
  return (await query(`{address:{equalTo:${JSON.stringify(address)}}}`, fetcher)).nodes.map((n) => toActivity(n, address));
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

// A code lookup reads the indexer in pages of CODE_PAGE nodes, the most the indexers return in one answer (measured
// 2026-10-17 on both: `first:200` and `first:500` come back with 100 nodes and no error). It follows the cursor until
// the indexer says there is no more, for at most CODE_MAX_PAGES pages; past that the answer is incomplete.
export const CODE_PAGE = 100;
export const CODE_MAX_PAGES = 10;

// Every node of one transaction code, in pages (ID_ASC is unique, so a cursor never skips or repeats a node).
// complete = false when there may be more than were read.
async function codeNodes(code: string, fetcher: typeof fetch): Promise<{ nodes: Node[]; complete: boolean }> {
  const filter = `{extrinsicHash:{equalTo:${JSON.stringify(code)}}}`;
  const all: Node[] = [];
  let after: string | null = null;
  for (let i = 0; i < CODE_MAX_PAGES; i++) {
    const page = await query(filter, fetcher, CODE_PAGE, { orderBy: 'ID_ASC', after });
    all.push(...page.nodes);
    // No page info: a short page is the last one; a full one may not be.
    if (page.next === undefined) return { nodes: all, complete: page.returned < CODE_PAGE };
    if (page.next === null) return { nodes: all, complete: true };
    after = page.next;
  }
  return { nodes: all, complete: false };
}

export type PaymentLookup =
  | { status: 'notFound' }
  // A transaction code: one entry per transfer it made (a batch makes several), each from the sender's side.
  //   arrived / failed: exactly one transfer, or (failed) several and none went through: a verdict is true.
  //   several: more than one transfer and at least one went through: no single verdict, the list says who got what.
  //   incomplete: more than CODE_MAX_PAGES pages (or a full page with no page info), so the list may be missing
//     transfers: no verdict at all.
  //   notAPayment / failedNotAPayment: the code made no transfer (and, for the latter, did not go through).
  | { kind: 'code'; status: 'arrived' | 'failed' | 'several' | 'incomplete' | 'notAPayment' | 'failedNotAPayment'; transfers: Activity[] }
  // An address: its most recent transfers, each relative to that address. No single verdict: the newest
  // transfer touching an address need not be the payment the person is asking about.
  | { kind: 'address'; status: 'recent'; address: string; transfers: Activity[] };

export async function findPayment(input: string, fetcher: typeof fetch = fetch): Promise<PaymentLookup> {
  const text = input.trim();
  if (CODE_RE.test(text)) {
    const { nodes, complete } = await codeNodes(text.toLowerCase(), fetcher);
    const transfers = firstOfEachEvent(nodes.filter((n) => n.transfer || n.assetTransfer).sort(byEvent))
      // Always the sender's perspective, so the answer does not depend on which node of a pair came first.
      .map((n) => toActivity(n, (n.transfer ?? n.assetTransfer)!.from));
    // The indexer may hold more than were read: no verdict.
    if (!complete) return { kind: 'code', status: 'incomplete', transfers };
    if (nodes.length === 0) return { status: 'notFound' };
    if (transfers.length === 0) {
      const ex = nodes.find((n) => n.extrinsic) ?? nodes[0];
      const ok = ex.extrinsic?.success ?? true;
      return { kind: 'code', status: ok ? 'notAPayment' : 'failedNotAPayment', transfers: [] };
    }
    const anyOk = transfers.some((a) => a.ok);
    const status = transfers.length === 1 ? (anyOk ? 'arrived' : 'failed') : anyOk ? 'several' : 'failed';
    return { kind: 'code', status, transfers };
  }
  const a = normaliseAddress(text);
  if (!a) throw new InvalidLookupError('not a code or address');
  // Newest first, as the indexer orders them; a self-transfer has both its nodes here and is shown once.
  const transfers = firstOfEachEvent((await query(`{address:{equalTo:${JSON.stringify(a)}}}`, fetcher)).nodes
    .filter((x) => x.transfer || x.assetTransfer))
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

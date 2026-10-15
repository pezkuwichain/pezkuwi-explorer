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

function toActivity(n: Node, me: string): Activity {
  const t = n.transfer ?? n.assetTransfer;
  const asset = n.assetTransfer ? NETWORK.assets.find((a) => String(a.id) === String(n.assetTransfer!.assetId)) : null;
  const symbol = asset?.symbol ?? (n.assetTransfer ? `#${n.assetTransfer.assetId}` : NETWORK.native.symbol);
  const decimals = n.assetTransfer ? (asset?.decimals ?? null) : NETWORK.native.decimals;
  if (!t) {
    return { id: n.id, when: Number(n.timestamp), direction: 'other', counterparty: null, symbol, decimals, amount: 0n,
      fee: BigInt(n.extrinsic?.fee ?? '0'), ok: n.extrinsic?.success ?? true, code: n.extrinsicHash };
  }
  const sent = normaliseAddress(t.from) === normaliseAddress(me);
  return { id: n.id, when: Number(n.timestamp), direction: sent ? 'sent' : 'received', counterparty: sent ? t.to : t.from,
    symbol, decimals, amount: BigInt(t.amount), fee: BigInt(t.fee), ok: t.success, code: n.extrinsicHash };
}

export async function loadActivity(address: string, fetcher: typeof fetch = fetch): Promise<Activity[]> {
  return (await query(`{address:{equalTo:${JSON.stringify(address)}}}`, fetcher)).map((n) => toActivity(n, address));
}

// Event index inside the block, parsed from ids like `<blk>-<idx>-from` / `-to`.
const eventIdx = (n: Node) => Number(n.id.split('-')[1] ?? Number.MAX_SAFE_INTEGER);

export async function findPayment(input: string, fetcher: typeof fetch = fetch) {
  const text = input.trim();
  let act: Activity | undefined;
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) {
    const nodes = await query(`{extrinsicHash:{equalTo:${JSON.stringify(text.toLowerCase())}}}`, fetcher);
    if (nodes.length === 0) return { status: 'notFound' as const };
    const transfers = nodes
      .filter((n) => n.transfer || n.assetTransfer)
      .sort((a, b) => eventIdx(a) - eventIdx(b) || Number(b.id.endsWith('-from')) - Number(a.id.endsWith('-from')));
    const first = transfers[0];
    if (!first) {
      const ex = nodes.find((n) => n.extrinsic) ?? nodes[0];
      const ok = ex.extrinsic?.success ?? true;
      return { status: ok ? ('notAPayment' as const) : ('failed' as const), activity: toActivity(ex, ex.address) };
    }
    // Always the sender's perspective, so the answer does not depend on which of the pair came first.
    act = toActivity(first, (first.transfer ?? first.assetTransfer)!.from);
  } else {
    const a = normaliseAddress(text);
    if (!a) throw new InvalidLookupError('not a code or address');
    const n = (await query(`{address:{equalTo:${JSON.stringify(a)}}}`, fetcher)).find((x) => x.transfer || x.assetTransfer);
    if (!n) return { status: 'notFound' as const };
    act = toActivity(n, a);
  }
  return { status: act.ok ? ('arrived' as const) : ('failed' as const), activity: act };
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

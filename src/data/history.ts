import { NETWORK } from '../config/network';
import { normaliseAddress } from '../lib/address';
import { withTimeout } from '../lib/timeout';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';

export class NotIndexedError extends Error {}
export type Activity = {
  id: string; when: number; direction: 'sent' | 'received' | 'other'; counterparty: string | null;
  symbol: string; decimals: number; amount: bigint; fee: bigint; ok: boolean; code: string | null;
};
type Node = {
  id: string; extrinsicHash: string | null; timestamp: string; address: string;
  transfer: { from: string; to: string; amount: string; fee: string; success: boolean } | null;
  assetTransfer: { assetId: string; from: string; to: string; amount: string; fee: string; success: boolean } | null;
  extrinsic: { fee: string; success: boolean } | null;
};
// transfer/assetTransfer/extrinsic are JSON scalars on this schema (no sub-selection).
const FIELDS = 'id extrinsicHash timestamp address transfer assetTransfer extrinsic';

async function query(filter: string, fetcher: typeof fetch): Promise<Node[]> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const body = JSON.stringify({ query: `{historyElements(first:25,orderBy:TIMESTAMP_DESC,filter:${filter}){nodes{${FIELDS}}}}` });
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }), REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(`history ${res.status}`);
  return (await res.json()).data.historyElements.nodes as Node[];
}

function toActivity(n: Node, me: string): Activity {
  const t = n.transfer ?? n.assetTransfer;
  const asset = n.assetTransfer ? NETWORK.assets.find((a) => String(a.id) === n.assetTransfer!.assetId) : null;
  const symbol = asset?.symbol ?? (n.assetTransfer ? `#${n.assetTransfer.assetId}` : NETWORK.native.symbol);
  const decimals = asset?.decimals ?? NETWORK.native.decimals;
  if (!t) {
    return { id: n.id, when: Number(n.timestamp), direction: 'other', counterparty: null, symbol, decimals, amount: 0n,
      fee: BigInt(n.extrinsic?.fee ?? '0'), ok: n.extrinsic?.success ?? true, code: n.extrinsicHash };
  }
  const sent = t.from === me;
  return { id: n.id, when: Number(n.timestamp), direction: sent ? 'sent' : 'received', counterparty: sent ? t.to : t.from,
    symbol, decimals, amount: BigInt(t.amount), fee: BigInt(t.fee), ok: t.success, code: n.extrinsicHash };
}

export async function loadActivity(address: string, fetcher: typeof fetch = fetch): Promise<Activity[]> {
  return (await query(`{address:{equalTo:${JSON.stringify(address)}}}`, fetcher)).map((n) => toActivity(n, address));
}

export async function findPayment(input: string, fetcher: typeof fetch = fetch) {
  const text = input.trim();
  let nodes: Node[];
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) {
    nodes = await query(`{extrinsicHash:{equalTo:${JSON.stringify(text.toLowerCase())}}}`, fetcher);
  } else {
    const a = normaliseAddress(text);
    if (!a) throw new Error('not a code or address');
    nodes = (await query(`{address:{equalTo:${JSON.stringify(a)}}}`, fetcher)).filter((n) => n.transfer || n.assetTransfer);
  }
  const n = nodes[0];
  if (!n) return { status: 'notFound' as const };
  const act = toActivity(n, n.address);
  return { status: act.ok ? ('arrived' as const) : ('failed' as const), activity: act };
}

export async function indexerLag(fetcher: typeof fetch = fetch): Promise<number> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{_metadata{lastProcessedHeight targetHeight}}' }) }), REQUEST_TIMEOUT_MS);
  const m = (await res.json()).data._metadata;
  return m.targetHeight - m.lastProcessedHeight;
}

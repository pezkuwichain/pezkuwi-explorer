// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { NETWORK } from '../config/network';
import { loadActivity, findPayment, indexerLag, InvalidLookupError, NotIndexedError } from './history';

const ME = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const node = (o: object) => ({ id: 'x', blockNumber: 1, extrinsicHash: '0x' + 'ab'.repeat(32), timestamp: '1800000000', address: ME, transfer: null, assetTransfer: null, extrinsic: null, ...o });
const reply = (nodes: object[]) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { historyElements: { nodes } } }) });

const CODE = '0x' + 'ab'.repeat(32);
const hist = NETWORK.history as { assetHub: string | null };
// Every test starts from a configured indexer and leaves the shipped setting behind, so no test depends on another's order.
const shipped = hist.assetHub;
beforeEach(() => { hist.assetHub = 'https://example.invalid/graphql'; });
afterEach(() => { hist.assetHub = shipped; });

describe('history', () => {
  it('throws NotIndexedError while no indexer is configured', async () => {
    hist.assetHub = null;
    await expect(loadActivity(ME)).rejects.toBeInstanceOf(NotIndexedError);
  });
  it('maps native and asset transfers into plain activity', async () => {
    const f = reply([
      node({ transfer: { from: ME, to: BOB, amount: '5000000000000', fee: '1000', success: true } }),
      node({ assetTransfer: { assetId: '1000', from: BOB, to: ME, amount: '1500000', fee: '0', success: true } }),
    ]);
    const a = await loadActivity(ME, f);
    expect(a[0]).toMatchObject({ direction: 'sent', counterparty: BOB, symbol: 'HEZ', amount: 5_000_000_000_000n, fee: 1000n, ok: true });
    expect(a[1]).toMatchObject({ direction: 'received', counterparty: BOB, symbol: 'wUSDT', decimals: 6, amount: 1_500_000n });
  });
  it('skips nodes with malformed remote fields and keeps the rest', async () => {
    const good = node({ id: 'good', transfer: { from: ME, to: BOB, amount: '7', fee: '1', success: true } });
    const f = reply([
      node({ id: 'nan', timestamp: 'abc', transfer: { from: ME, to: BOB, amount: '1', fee: '1', success: true } }),
      node({ id: 'exp', transfer: { from: ME, to: BOB, amount: '1e5', fee: '1', success: true } }),
      node({ id: 'nullfrom', transfer: { from: null, to: BOB, amount: '1', fee: '1', success: true } }),
      good,
    ]);
    const a = await loadActivity(ME, f);
    expect(a.map((x) => x.id)).toEqual(['good']);
  });
  it('reports a failed payment as failed, not as missing', async () => {
    const f = reply([node({ transfer: { from: ME, to: BOB, amount: '1', fee: '1', success: false } })]);
    const r = await findPayment(CODE, f);
    expect(r).toMatchObject({ kind: 'code', status: 'failed' });
    expect(r.status !== 'notFound' && r.transfers).toHaveLength(1);
  });
  it('reports notFound for an unknown code', async () => {
    expect((await findPayment('0x' + 'cd'.repeat(32), reply([]))).status).toBe('notFound');
  });
  it('rejects input that is neither a code nor an address', async () => {
    await expect(findPayment('hello', reply([]))).rejects.toBeInstanceOf(InvalidLookupError);
    await expect(findPayment('0x' + 'ab'.repeat(20), reply([]))).rejects.toBeInstanceOf(InvalidLookupError);
  });
  it('computes indexer lag from metadata', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { _metadata: { lastProcessedHeight: 90, targetHeight: 120 } } }) });
    expect(await indexerLag(f)).toBe(30);
  });
  it('says a non-transfer code is not a payment, and a failed one failed', async () => {
    const ok = reply([node({ id: '5-1-extrinsic', extrinsic: { fee: '1', success: true } })]);
    expect(await findPayment(CODE, ok)).toEqual({ kind: 'code', status: 'notAPayment', transfers: [] });
    const bad = reply([node({ id: '5-1-extrinsic', extrinsic: { fee: '1', success: false } })]);
    expect(await findPayment(CODE, bad)).toEqual({ kind: 'code', status: 'failed', transfers: [] });
  });
  it('a code covering several transfers (a batch) reports every one, once, in event order, from the sender', async () => {
    const mk = (id: string, address: string, amount: string) => node({ id, address, transfer: { from: ME, to: BOB, amount, fee: '1', success: true } });
    const nodes = [mk('9-4-to', BOB, '4'), mk('9-4-from', ME, '4'), mk('9-2-to', BOB, '2')];
    for (const order of [nodes, [...nodes].reverse()]) {
      const r = await findPayment(CODE, reply(order));
      expect(r).toMatchObject({ kind: 'code', status: 'arrived' });
      if (r.status === 'notFound') throw new Error('unreachable');
      expect(r.transfers.map((a) => a.id)).toEqual(['9-2-to', '9-4-from']);
      expect(r.transfers.map((a) => a.amount)).toEqual([2n, 4n]);
      for (const a of r.transfers) expect(a).toMatchObject({ direction: 'sent', counterparty: BOB });
    }
  });
  it('a batch where only some transfers went through is partial', async () => {
    const t = (success: boolean) => ({ from: ME, to: BOB, amount: '1', fee: '1', success });
    const r = await findPayment(CODE, reply([node({ id: '9-1-from', transfer: t(true) }), node({ id: '9-2-from', transfer: t(false) })]));
    expect(r).toMatchObject({ kind: 'code', status: 'partial' });
  });
  it('a non-numeric event index sorts last, deterministically, whatever the node order', async () => {
    const mk = (id: string) => node({ id, transfer: { from: ME, to: BOB, amount: '1', fee: '1', success: true } });
    const nodes = [mk('9-x-from'), mk('9-3-from'), mk('weird'), mk('9-1-from')];
    const seen = new Set<string>();
    for (const order of [nodes, [...nodes].reverse(), [nodes[2], nodes[0], nodes[3], nodes[1]]]) {
      const r = await findPayment(CODE, reply(order));
      if (r.status === 'notFound') throw new Error('unreachable');
      const ids = r.transfers.map((a) => a.id);
      expect(ids.slice(0, 2)).toEqual(['9-1-from', '9-3-from']);
      seen.add(ids.join(','));
    }
    expect(seen.size).toBe(1);
  });
  it('an address lookup lists up to five recent transfers relative to that address, with no single verdict', async () => {
    const mk = (i: number, from: string, to: string) =>
      node({ id: `${i}-1-x`, timestamp: String(1_800_000_000 - i), transfer: { from, to, amount: String(i), fee: '0', success: i !== 2 } });
    const nodes = [mk(1, BOB, ME), mk(2, ME, BOB), node({ id: 'e', extrinsic: { fee: '1', success: true } }),
      mk(3, BOB, ME), mk(4, ME, BOB), mk(5, BOB, ME), mk(6, ME, BOB), mk(7, BOB, ME)];
    const f = reply(nodes);
    const other = encodeAddress(decodeAddress(ME), 0);
    const r = await findPayment(other, f);
    expect(r).toMatchObject({ kind: 'address', status: 'recent', address: ME });
    if (r.status === 'notFound') throw new Error('unreachable');
    expect(r.transfers.map((a) => a.amount)).toEqual([1n, 2n, 3n, 4n, 5n]);
    expect(r.transfers.map((a) => a.direction)).toEqual(['received', 'sent', 'received', 'sent', 'received']);
    expect(r.transfers.map((a) => a.ok)).toEqual([true, false, true, true, true]);
    for (const a of r.transfers) expect(a.counterparty).toBe(BOB);
    // The query asks for the normalised address, not the text as typed.
    expect(JSON.parse(f.mock.calls[0][1].body).query).toContain(JSON.stringify(ME));
  });
  it('an address with no transfers is notFound', async () => {
    expect((await findPayment(ME, reply([node({ extrinsic: { fee: '1', success: true } })]))).status).toBe('notFound');
  });
  it('two unreadable addresses are not equal: an unparseable sender is never "sent"', async () => {
    const f = reply([node({ address: 'garbage', transfer: { from: 'garbage', to: 'also-garbage', amount: '1', fee: '0', success: true } })]);
    const [a] = await loadActivity('not-an-address', f);
    expect(a.direction).not.toBe('sent');
    expect(a).toMatchObject({ direction: 'other', counterparty: null });
  });
  it('a valid sender against an unreadable account is not "sent" either', async () => {
    const [a] = await loadActivity('not-an-address', reply([node({ transfer: { from: ME, to: BOB, amount: '1', fee: '0', success: true } })]));
    expect(a.direction).toBe('other');
  });
  it('the transaction code is kept only when it is 0x and 64 hex digits', async () => {
    const t = { from: ME, to: BOB, amount: '1', fee: '0', success: true };
    const f = reply([
      node({ id: 'a', extrinsicHash: CODE, transfer: t }),
      node({ id: 'b', extrinsicHash: '0x' + 'AB'.repeat(32), transfer: t }),
      node({ id: 'c', extrinsicHash: 'zzz', transfer: t }),
      node({ id: 'd', extrinsicHash: '0x' + 'ab'.repeat(31), transfer: t }),
      node({ id: 'e', extrinsicHash: null, transfer: t }),
      node({ id: 'f', extrinsicHash: undefined, transfer: t }),
      node({ id: 'g', extrinsicHash: CODE + 'ff', extrinsic: { fee: '1', success: true } }),
    ]);
    expect((await loadActivity(ME, f)).map((a) => a.code)).toEqual([CODE, CODE, null, null, null, null, null]);
  });
  it('compares addresses by public key, not by string', async () => {
    const other = encodeAddress(decodeAddress(ME), 0);
    const f = reply([node({ transfer: { from: other, to: BOB, amount: '1', fee: '0', success: true } })]);
    expect((await loadActivity(ME, f))[0]).toMatchObject({ direction: 'sent', counterparty: BOB });
  });
  it('gives null decimals for an unknown asset and accepts numeric asset ids', async () => {
    const f = reply([
      node({ assetTransfer: { assetId: 777, from: BOB, to: ME, amount: '5', fee: '0', success: true } }),
      node({ assetTransfer: { assetId: 1000, from: BOB, to: ME, amount: '5', fee: '0', success: true } }),
    ]);
    const a = await loadActivity(ME, f);
    expect(a[0]).toMatchObject({ symbol: '#777', decimals: null });
    expect(a[1]).toMatchObject({ symbol: 'wUSDT', decimals: 6 });
  });
  it('rejects malformed indexer answers', async () => {
    const bad = (body: object, ok = true) => vi.fn().mockResolvedValue({ ok, status: 500, json: async () => body });
    await expect(indexerLag(bad({}, false))).rejects.toThrow();
    await expect(indexerLag(bad({ data: { _metadata: { lastProcessedHeight: null, targetHeight: 5 } } }))).rejects.toThrow();
    await expect(indexerLag(bad({ data: {} }))).rejects.toThrow();
    await expect(loadActivity(ME, bad({ data: {} }))).rejects.toThrow(/malformed/);
  });
});

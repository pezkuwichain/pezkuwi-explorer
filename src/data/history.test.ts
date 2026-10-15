// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { NETWORK } from '../config/network';
import { loadActivity, findPayment, indexerLag, NotIndexedError } from './history';

const ME = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const node = (o: object) => ({ id: 'x', blockNumber: 1, extrinsicHash: '0x' + 'ab'.repeat(32), timestamp: '1800000000', address: ME, transfer: null, assetTransfer: null, extrinsic: null, ...o });
const reply = (nodes: object[]) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { historyElements: { nodes } } }) });

describe('history', () => {
  it('throws NotIndexedError while no indexer is configured', async () => {
    (NETWORK.history as { assetHub: string | null }).assetHub = null;
    await expect(loadActivity(ME)).rejects.toBeInstanceOf(NotIndexedError);
  });
  it('maps native and asset transfers into plain activity', async () => {
    (NETWORK.history as { assetHub: string | null }).assetHub = 'https://example.invalid/graphql';
    const f = reply([
      node({ transfer: { from: ME, to: BOB, amount: '5000000000000', fee: '1000', success: true } }),
      node({ assetTransfer: { assetId: '1000', from: BOB, to: ME, amount: '1500000', fee: '0', success: true } }),
    ]);
    const a = await loadActivity(ME, f);
    expect(a[0]).toMatchObject({ direction: 'sent', counterparty: BOB, symbol: 'HEZ', amount: 5_000_000_000_000n, fee: 1000n, ok: true });
    expect(a[1]).toMatchObject({ direction: 'received', counterparty: BOB, symbol: 'wUSDT', decimals: 6, amount: 1_500_000n });
  });
  it('skips nodes with malformed remote fields and keeps the rest', async () => {
    (NETWORK.history as { assetHub: string | null }).assetHub = 'https://example.invalid/graphql';
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
    expect((await findPayment('0x' + 'ab'.repeat(32), f)).status).toBe('failed');
  });
  it('reports notFound for an unknown code', async () => {
    expect((await findPayment('0x' + 'cd'.repeat(32), reply([]))).status).toBe('notFound');
  });
  it('rejects input that is neither a code nor an address', async () => {
    await expect(findPayment('hello', reply([]))).rejects.toThrow();
  });
  it('computes indexer lag from metadata', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { _metadata: { lastProcessedHeight: 90, targetHeight: 120 } } }) });
    expect(await indexerLag(f)).toBe(30);
  });
  it('says a non-transfer code is not a payment, and a failed one failed', async () => {
    const ok = reply([node({ id: '5-1-extrinsic', extrinsic: { fee: '1', success: true } })]);
    expect((await findPayment('0x' + 'ab'.repeat(32), ok)).status).toBe('notAPayment');
    const bad = reply([node({ id: '5-1-extrinsic', extrinsic: { fee: '1', success: false } })]);
    expect((await findPayment('0x' + 'ab'.repeat(32), bad)).status).toBe('failed');
  });
  it('code lookup is deterministic: lowest event index, sender perspective, either node order', async () => {
    const t = { from: ME, to: BOB, amount: '7', fee: '1', success: true };
    const mk = (id: string, address: string) => node({ id, address, transfer: t });
    const nodes = [mk('9-4-to', BOB), mk('9-4-from', ME), mk('9-2-to', BOB)];
    for (const order of [nodes, [...nodes].reverse()]) {
      const r = await findPayment('0x' + 'ab'.repeat(32), reply(order));
      expect(r.activity).toMatchObject({ id: '9-2-to', direction: 'sent', counterparty: BOB });
    }
    const tie = [mk('9-4-to', BOB), mk('9-4-from', ME)];
    expect((await findPayment('0x' + 'ab'.repeat(32), reply(tie))).activity?.id).toBe('9-4-from');
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

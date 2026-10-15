// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
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
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadAssetBalances, loadHezBalance, loadIWalletBalances } from './data';

const acct = (free: bigint, reserved: bigint, frozen = 0n) => ({ data: { free: { toBigInt: () => free }, reserved: { toBigInt: () => reserved }, frozen: { toBigInt: () => frozen } } });
const asset = (bal: bigint | null) => ({ isSome: bal !== null, unwrap: () => ({ balance: { toBigInt: () => bal ?? 0n } }) });
const natives: Record<string, [bigint, bigint, bigint?]> = { relay: [1n, 2n], assetHub: [10n, 5n], people: [100n, 0n] };

const fake = (chain: string) => Promise.resolve({
  query: {
    system: { account: () => Promise.resolve(acct(...natives[chain])) },
    assets: { account: (id: number) => Promise.resolve(asset(id === 1 ? 7n : null)) },
  },
}) as never;

describe('i-Wallet balances', () => {
  it('sums free + reserved per chain and exposes the free Asset Hub HEZ', async () => {
    const h = await loadHezBalance('5Grw', { getApi: fake });
    expect(h.perChain).toEqual({ relay: 3n, assetHub: 15n, people: 100n });
    expect(h.total).toBe(118n);
    expect(h.assetHubSpendable).toBe(10n);
  });

  it('spendable = free - max(frozen - reserved, 0): frozen above reserved', async () => {
    natives.assetHub = [10n, 3n, 8n];
    expect((await loadHezBalance('5Grw', { getApi: fake })).assetHubSpendable).toBe(5n);
    natives.assetHub = [10n, 3n, 20n];
    expect((await loadHezBalance('5Grw', { getApi: fake })).assetHubSpendable).toBe(0n);
  });

  it('spendable = free when frozen <= reserved', async () => {
    natives.assetHub = [10n, 3n, 3n];
    expect((await loadHezBalance('5Grw', { getApi: fake })).assetHubSpendable).toBe(10n);
    natives.assetHub = [10n, 3n, 0n];
    expect((await loadHezBalance('5Grw', { getApi: fake })).assetHubSpendable).toBe(10n);
    natives.assetHub = [10n, 5n];
  });

  it('fails closed when one chain rejects (no partial HEZ total)', async () => {
    const failing = (chain: string) => (chain === 'people' ? Promise.reject(new Error('down')) : fake(chain));
    await expect(loadHezBalance('5Grw', { getApi: failing as never })).rejects.toThrow('down');
  });

  it('lists PEZ and USDT (zero when no account) from Asset Hub', async () => {
    expect(await loadAssetBalances('5Grw', { getApi: fake })).toEqual([
      { id: 1, symbol: 'PEZ', decimals: 12, amount: 7n },
      { id: 1000, symbol: 'USDT', decimals: 6, amount: 0n },
    ]);
  });

  it('a failing relay fails the HEZ card but not the asset rows', async () => {
    const failing = (chain: string) => (chain === 'relay' ? Promise.reject(new Error('down')) : fake(chain));
    const r = await loadIWalletBalances('5Grw', { getApi: failing as never });
    expect(r.hez.status).toBe('rejected');
    expect(r.assets.status).toBe('fulfilled');
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadBalances } from './balances';

const acct = (free: bigint, reserved: bigint) => ({ data: { free: { toBigInt: () => free }, reserved: { toBigInt: () => reserved } } });
const asset = (bal: bigint | null) => ({ isSome: bal !== null, unwrap: () => ({ balance: { toBigInt: () => bal ?? 0n } }) });
const natives: Record<string, [bigint, bigint]> = { relay: [1n, 2n], assetHub: [10n, 0n], people: [100n, 0n] };

const fake = (chain: string) => Promise.resolve({
  query: {
    system: { account: () => Promise.resolve(acct(...natives[chain])) },
    assets: { account: (id: number) => Promise.resolve(asset(id === 1 ? 5n : id === 1000 ? null : 0n)) },
  },
}) as never;

describe('loadBalances', () => {
  it('sums HEZ across relay, Asset Hub and People and lists non-zero assets', async () => {
    const r = await loadBalances('5Grw', { getApi: fake });
    expect(r).toEqual([
      { symbol: 'HEZ', decimals: 12, amount: 113n, perChain: { relay: 3n, assetHub: 10n, people: 100n } },
      { symbol: 'PEZ', decimals: 12, amount: 5n },
    ]);
  });

  it('the per-chain native amounts add up to the HEZ total', async () => {
    const [hez] = await loadBalances('5Grw', { getApi: fake });
    const { relay, assetHub, people } = hez.perChain!;
    expect(relay + assetHub + people).toBe(hez.amount);
  });

  it('fails closed when the People chain rejects (no partial HEZ total)', async () => {
    const failing = (chain: string) => (chain === 'people' ? Promise.reject(new Error('down')) : fake(chain));
    await expect(loadBalances('5Grw', { getApi: failing as never })).rejects.toThrow('down');
  });
});

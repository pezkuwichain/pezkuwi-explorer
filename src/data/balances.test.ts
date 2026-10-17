// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadBalances } from './balances';
import { NETWORK } from '../config/network';

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

  it('reads the network it is given (its native token and asset ids) and keeps zero assets with keepZero', async () => {
    const network = { ...NETWORK, native: { symbol: 'TST', decimals: 10 }, assets: [{ id: 7, symbol: 'SEVEN', decimals: 3 }, { id: 1000, symbol: 'NONE', decimals: 6, standard: 'X-1' }] };
    const asked: number[] = [];
    type Api = { query: { assets: { account: (id: number) => unknown } } };
    const custom = (chain: string) => (fake(chain) as Promise<Api>).then((api) => {
      const real = api.query.assets.account;
      api.query.assets.account = (id: number) => { asked.push(id); return real(id); };
      return api;
    }) as never;
    const r = await loadBalances('5Grw', { getApi: custom }, { network, keepZero: true });
    expect(asked).toEqual([7, 1000]);
    expect(r).toEqual([
      { symbol: 'TST', decimals: 10, amount: 113n, perChain: { relay: 3n, assetHub: 10n, people: 100n } },
      { symbol: 'SEVEN', decimals: 3, amount: 0n },
      { symbol: 'NONE', decimals: 6, amount: 0n, standard: 'X-1' },
    ]);
  });

  it('fails closed when the People chain rejects (no partial HEZ total)', async () => {
    const failing = (chain: string) => (chain === 'people' ? Promise.reject(new Error('down')) : fake(chain));
    await expect(loadBalances('5Grw', { getApi: failing as never })).rejects.toThrow('down');
  });
});

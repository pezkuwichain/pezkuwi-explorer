// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chainSpendable, loadAssetBalances, loadWalletHoldings } from './data';

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
  it('the home card: HEZ total with its split per chain, then PEZ and USDT (kept at zero, with the USDT standard)', async () => {
    expect(await loadWalletHoldings('5Grw', { getApi: fake })).toEqual([
      { symbol: 'HEZ', decimals: 12, amount: 118n, perChain: { relay: 3n, assetHub: 15n, people: 100n } },
      { symbol: 'PEZ', decimals: 12, amount: 7n },
      { symbol: 'USDT', decimals: 6, amount: 0n, standard: 'PEZ-20' },
    ]);
  });

  it('fails closed when one chain rejects (no partial HEZ total)', async () => {
    const failing = (chain: string) => (chain === 'people' ? Promise.reject(new Error('down')) : fake(chain));
    await expect(loadWalletHoldings('5Grw', { getApi: failing as never })).rejects.toThrow('down');
  });

  it('spendable on a chain = free - max(frozen - reserved, 0)', async () => {
    const at = (v: [bigint, bigint, bigint?]) => { natives.relay = v; return chainSpendable('relay', '5Grw', { getApi: fake }); };
    expect(await at([10n, 3n, 8n])).toBe(5n);
    expect(await at([10n, 3n, 20n])).toBe(0n);
    expect(await at([10n, 3n, 3n])).toBe(10n);
    expect(await at([10n, 3n, 0n])).toBe(10n);
    natives.relay = [1n, 2n];
  });

  it('lists PEZ and USDT (zero when no account) from Asset Hub', async () => {
    expect(await loadAssetBalances('5Grw', { getApi: fake })).toEqual([
      { id: 1, symbol: 'PEZ', decimals: 12, amount: 7n },
      { id: 1000, symbol: 'USDT', decimals: 6, amount: 0n },
    ]);
  });
});

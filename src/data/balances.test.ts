// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadBalances } from './balances';

const acct = (free: bigint, reserved: bigint) => ({ data: { free: { toBigInt: () => free }, reserved: { toBigInt: () => reserved } } });
const asset = (bal: bigint | null) => ({ isSome: bal !== null, unwrap: () => ({ balance: { toBigInt: () => bal ?? 0n } }) });

const fake = (chain: string) => Promise.resolve({
  query: {
    system: { account: () => Promise.resolve(chain === 'relay' ? acct(1n, 2n) : acct(10n, 0n)) },
    assets: { account: (id: number) => Promise.resolve(asset(id === 1 ? 5n : id === 1000 ? null : 0n)) },
  },
}) as never;

describe('loadBalances', () => {
  it('sums HEZ across relay and Asset Hub and lists non-zero assets', async () => {
    const r = await loadBalances('5Grw', { getApi: fake });
    expect(r).toEqual([
      { symbol: 'HEZ', decimals: 12, amount: 13n },
      { symbol: 'PEZ', decimals: 12, amount: 5n },
    ]);
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// The i-Wallet home must read mainnet (getMainnetApi), never the explorer's Zagros connections. Called here without
// injected deps, so a loadWalletHoldings that fell back to loadBalances' defaults, or a `real` that pointed at
// src/chain/connections, would hit the throwing Zagros factory below and fail.
const seen = vi.hoisted(() => ({ mainnet: [] as string[], zagros: [] as string[] }));
const acct = (free: bigint) => ({ data: { free: { toBigInt: () => free }, reserved: { toBigInt: () => 0n }, frozen: { toBigInt: () => 0n } } });
const asset = (bal: bigint) => ({ isSome: true, unwrap: () => ({ balance: { toBigInt: () => bal } }) });
const fake = (chain: string) => ({
  query: {
    system: { account: () => Promise.resolve(acct(chain === 'relay' ? 1n : chain === 'assetHub' ? 2n : 4n)) },
    assets: { account: (id: number) => Promise.resolve(asset(BigInt(id))) },
  },
});
vi.mock('./chain', () => ({
  getMainnetApi: (chain: string) => { seen.mainnet.push(chain); return Promise.resolve(fake(chain)); },
}));
vi.mock('../chain/connections', async (orig) => ({
  ...(await orig<typeof import('../chain/connections')>()),
  getApi: (chain: string) => { seen.zagros.push(chain); return Promise.reject(new Error('Zagros connection used')); },
}));
import { loadAssetHoldings, loadWalletHoldings } from './data';

describe('i-Wallet home routing', () => {
  it('reads every chain through the mainnet connections and none through Zagros', async () => {
    seen.mainnet = []; seen.zagros = [];
    const h = await loadWalletHoldings('5Grw');
    expect([...seen.mainnet].sort()).toEqual(['assetHub', 'people', 'relay']);
    expect(seen.zagros).toEqual([]);
    expect(h[0]).toMatchObject({ symbol: 'HEZ', amount: 7n, perChain: { relay: 1n, assetHub: 2n, people: 4n } });
  });

  it('the Asset Hub fallback reads mainnet Asset Hub only, PEZ and USDT with its standard', async () => {
    seen.mainnet = []; seen.zagros = [];
    expect(await loadAssetHoldings('5Grw')).toEqual([
      { symbol: 'PEZ', decimals: 12, amount: 1n },
      { symbol: 'USDT', decimals: 6, amount: 1000n, standard: 'PEZ-20' },
    ]);
    expect(seen.mainnet).toEqual(['assetHub']);
    expect(seen.zagros).toEqual([]);
  });
});

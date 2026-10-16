import type { ApiPromise } from '@pezkuwi/api';
import type { ChainKey } from '../config/network';
import { IWALLET_NETWORK } from '../config/iwallet-network';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';
import { withTimeout } from '../lib/timeout';
import { getMainnetApi } from './chain';

type Deps = { getApi: (chain: ChainKey) => Promise<ApiPromise> };
const real: Deps = { getApi: getMainnetApi };

export type HezBalance = {
  /** free + reserved, summed over relay, Asset Hub and People. */
  total: bigint;
  perChain: Record<ChainKey, bigint>;
  /** Free (spendable) HEZ on Asset Hub only: where HEZ transfers are made (Send uses it). */
  assetHubFree: bigint;
};
export type AssetBalance = { id: number; symbol: string; decimals: number; amount: bigint };

// Fail-closed like src/data/balances.ts: if any of the three chains fails or times out this rejects, so the card
// says "could not load". A partial HEZ total would be a too-low money figure, which is worse than an error.
export async function loadHezBalance(address: string, deps: Deps = real): Promise<HezBalance> {
  const [relay, assetHub, people] = await Promise.all([deps.getApi('relay'), deps.getApi('assetHub'), deps.getApi('people')]);
  const account = async (api: ApiPromise) => {
    const a = (await withTimeout(api.query.system.account(address), REQUEST_TIMEOUT_MS)) as never as {
      data: { free: { toBigInt(): bigint }; reserved: { toBigInt(): bigint } };
    };
    return { free: a.data.free.toBigInt(), reserved: a.data.reserved.toBigInt() };
  };
  const [r, a, p] = await Promise.all([account(relay), account(assetHub), account(people)]);
  const sum = (x: { free: bigint; reserved: bigint }) => x.free + x.reserved;
  return {
    total: sum(r) + sum(a) + sum(p),
    perChain: { relay: sum(r), assetHub: sum(a), people: sum(p) },
    assetHubFree: a.free,
  };
}

// PEZ and USDT live on Asset Hub; their rows fail as their own card, independent of the HEZ total.
export async function loadAssetBalances(address: string, deps: Deps = real): Promise<AssetBalance[]> {
  const assetHub = await deps.getApi('assetHub');
  return Promise.all(IWALLET_NETWORK.assets.map(async (asset) => {
    const opt = (await withTimeout(assetHub.query.assets.account(asset.id, address), REQUEST_TIMEOUT_MS)) as never as {
      isSome: boolean; unwrap(): { balance: { toBigInt(): bigint } };
    };
    return { id: asset.id, symbol: asset.symbol, decimals: asset.decimals, amount: opt.isSome ? opt.unwrap().balance.toBigInt() : 0n };
  }));
}

export async function loadIWalletBalances(address: string, deps: Deps = real) {
  const [hez, assets] = await Promise.allSettled([loadHezBalance(address, deps), loadAssetBalances(address, deps)]);
  return { hez, assets };
}

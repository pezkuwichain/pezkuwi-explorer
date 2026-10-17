import type { ApiPromise } from '@pezkuwi/api';
import type { ChainKey } from '../config/network';
import { IWALLET_NETWORK } from '../config/iwallet-network';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';
import { withTimeout } from '../lib/timeout';
import { getMainnetApi } from './chain';
import { loadBalances, type Holding } from '../data/balances';

type Deps = { getApi: (chain: ChainKey) => Promise<ApiPromise> };
const real: Deps = { getApi: getMainnetApi };

// Spendable HEZ: free - max(frozen - reserved, 0). Frozen applies over free + reserved.
export const spendable = (a: { free: bigint; reserved: bigint; frozen: bigint }): bigint => {
  const locked = a.frozen > a.reserved ? a.frozen - a.reserved : 0n;
  return a.free > locked ? a.free - locked : 0n;
};
export type AssetBalance = { id: number; symbol: string; decimals: number; amount: bigint };

// The home card: the explorer's own balance loader (the Account tab's), on the mainnet connections and config.
// Fail-closed like the Account tab: any of the three chains failing rejects, so the card says "could not load" rather
// than show a partial HEZ total. PEZ and USDT stay listed at zero, since they are what the wallet can send.
export function loadWalletHoldings(address: string, deps: Deps = real): Promise<Holding[]> {
  return loadBalances(address, deps, { network: IWALLET_NETWORK, keepZero: true });
}

// PEZ and USDT live on Asset Hub (Send reads them for an asset transfer).
export async function loadAssetBalances(address: string, deps: Deps = real): Promise<AssetBalance[]> {
  const assetHub = await deps.getApi('assetHub');
  return Promise.all(IWALLET_NETWORK.assets.map(async (asset) => {
    const opt = (await withTimeout(assetHub.query.assets.account(asset.id, address), REQUEST_TIMEOUT_MS)) as never as {
      isSome: boolean; unwrap(): { balance: { toBigInt(): bigint } };
    };
    return { id: asset.id, symbol: asset.symbol, decimals: asset.decimals, amount: opt.isSome ? opt.unwrap().balance.toBigInt() : 0n };
  }));
}

// The home's fallback when the HEZ card fails (it is fail-closed): PEZ and USDT read from Asset Hub alone, so a relay
// or People outage does not hide them. No HEZ row: a partial HEZ figure is never shown.
export async function loadAssetHoldings(address: string, deps: Deps = real): Promise<Holding[]> {
  const balances = await loadAssetBalances(address, deps);
  return balances.map((b) => {
    const standard = IWALLET_NETWORK.assets.find((a) => a.id === b.id)?.standard;
    return { symbol: b.symbol, decimals: b.decimals, amount: b.amount, ...(standard ? { standard } : {}) };
  });
}

// Spendable HEZ on one chain (free minus the part frozen beyond reserved). Send reads each chain on its own, so an
// outage of one network never blocks a transfer on another.
export async function chainSpendable(chain: ChainKey, address: string, deps: Deps = real): Promise<bigint> {
  const api = await deps.getApi(chain);
  const a = (await withTimeout(api.query.system.account(address), REQUEST_TIMEOUT_MS)) as never as {
    data: { free: { toBigInt(): bigint }; reserved: { toBigInt(): bigint }; frozen: { toBigInt(): bigint } };
  };
  return spendable({ free: a.data.free.toBigInt(), reserved: a.data.reserved.toBigInt(), frozen: a.data.frozen.toBigInt() });
}

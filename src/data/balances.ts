import { getApi as realGetApi, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { NETWORK, type ChainKey, type NetworkConfig } from '../config/network';
import { withTimeout } from '../lib/timeout';

// perChain is set on the native holding only: where its total sits (the three always add up to amount).
export type Holding = { symbol: string; decimals: number; amount: bigint; perChain?: Record<ChainKey, bigint>; standard?: string };

// Fail-closed by design: if any chain fails or times out this rejects, and the
// card shows "could not load". Never return a partial HEZ total; a too-low money
// figure is worse than an error.
// The explorer reads Zagros (the defaults); the i-Wallet passes its mainnet connections and config, and keeps the
// assets it can send listed at zero (keepZero) so a new wallet still sees what it can hold.
export async function loadBalances(
  address: string,
  deps: { getApi: typeof realGetApi } = { getApi: realGetApi },
  opts: { network?: NetworkConfig; keepZero?: boolean } = {},
): Promise<Holding[]> {
  const network = opts.network ?? NETWORK;
  const [relay, ah, people] = await Promise.all([deps.getApi('relay'), deps.getApi('assetHub'), deps.getApi('people')]);
  const native = async (api: typeof relay) => {
    const a = (await withTimeout(api.query.system.account(address), REQUEST_TIMEOUT_MS)) as never as {
      data: { free: { toBigInt(): bigint }; reserved: { toBigInt(): bigint } };
    };
    return a.data.free.toBigInt() + a.data.reserved.toBigInt();
  };
  const [rHez, aHez, pHez] = await Promise.all([native(relay), native(ah), native(people)]);
  const out: Holding[] = [{ symbol: network.native.symbol, decimals: network.native.decimals, amount: rHez + aHez + pHez,
    perChain: { relay: rHez, assetHub: aHez, people: pHez } }];
  const amounts = await Promise.all(network.assets.map(async (asset) => {
    const opt = (await withTimeout(ah.query.assets.account(asset.id, address), REQUEST_TIMEOUT_MS)) as never as {
      isSome: boolean; unwrap(): { balance: { toBigInt(): bigint } };
    };
    return opt.isSome ? opt.unwrap().balance.toBigInt() : 0n;
  }));
  network.assets.forEach((asset, i) => {
    if (amounts[i] > 0n || opts.keepZero) out.push({ symbol: asset.symbol, decimals: asset.decimals, amount: amounts[i], ...(asset.standard ? { standard: asset.standard } : {}) });
  });
  return out;
}

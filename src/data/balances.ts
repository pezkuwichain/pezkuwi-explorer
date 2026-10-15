import { getApi as realGetApi, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { NETWORK } from '../config/network';
import { withTimeout } from '../lib/timeout';

export type Holding = { symbol: string; decimals: number; amount: bigint };

export async function loadBalances(address: string, deps = { getApi: realGetApi }): Promise<Holding[]> {
  const [relay, ah] = await Promise.all([deps.getApi('relay'), deps.getApi('assetHub')]);
  const native = async (api: typeof relay) => {
    const a = (await withTimeout(api.query.system.account(address), REQUEST_TIMEOUT_MS)) as never as {
      data: { free: { toBigInt(): bigint }; reserved: { toBigInt(): bigint } };
    };
    return a.data.free.toBigInt() + a.data.reserved.toBigInt();
  };
  const [rHez, aHez] = await Promise.all([native(relay), native(ah)]);
  const out: Holding[] = [{ symbol: NETWORK.native.symbol, decimals: NETWORK.native.decimals, amount: rHez + aHez }];
  const amounts = await Promise.all(NETWORK.assets.map(async (asset) => {
    const opt = (await withTimeout(ah.query.assets.account(asset.id, address), REQUEST_TIMEOUT_MS)) as never as {
      isSome: boolean; unwrap(): { balance: { toBigInt(): bigint } };
    };
    return opt.isSome ? opt.unwrap().balance.toBigInt() : 0n;
  }));
  NETWORK.assets.forEach((asset, i) => {
    if (amounts[i] > 0n) out.push({ symbol: asset.symbol, decimals: asset.decimals, amount: amounts[i] });
  });
  return out;
}

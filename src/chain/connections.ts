import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { NETWORK, type ChainKey } from '../config/network';
import { withTimeout } from '../lib/timeout';

export const REQUEST_TIMEOUT_MS = 10_000;
const cache = new Map<ChainKey, Promise<ApiPromise>>();

export function getApi(chain: ChainKey): Promise<ApiPromise> {
  let p = cache.get(chain);
  if (!p) {
    const provider = new WsProvider([...NETWORK.chains[chain].rpc], 2_500);
    p = withTimeout(ApiPromise.create({ provider, noInitWarn: true }), REQUEST_TIMEOUT_MS);
    p.catch(() => { cache.delete(chain); void provider.disconnect(); });
    cache.set(chain, p);
  }
  return p;
}

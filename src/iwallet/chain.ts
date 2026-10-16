import { ApiPromise, WsProvider } from '@pezkuwi/api';
import type { ChainKey } from '../config/network';
import { IWALLET_NETWORK, IWALLET_SIGNED_EXTENSIONS } from '../config/iwallet-network';
import { CONNECT_GIVE_UP_MS, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { withTimeout } from '../lib/timeout';

// Mainnet connections for i-Wallet: a cache separate from src/chain/connections.ts (Zagros),
// with the same timeout and retry behaviour.
type Attempt = { api: Promise<ApiPromise>; disconnect: () => void };
const realFactory = (chain: ChainKey): Attempt => {
  const provider = new WsProvider([...IWALLET_NETWORK.chains[chain].rpc], 2_500);
  return {
    api: ApiPromise.create({ provider, noInitWarn: true, signedExtensions: { ...IWALLET_SIGNED_EXTENSIONS } }),
    disconnect: () => { void provider.disconnect(); },
  };
};
let factory: (chain: ChainKey) => Attempt = realFactory;
const cache = new Map<ChainKey, Promise<ApiPromise>>();

export function __setMainnetApiFactoryForTests(f?: (chain: ChainKey) => Attempt) {
  factory = f ?? realFactory;
  cache.clear();
}

function connect(chain: ChainKey): Promise<ApiPromise> {
  const { api, disconnect } = factory(chain);
  const evict = () => { if (cache.get(chain) === p) cache.delete(chain); disconnect(); };
  const giveUp = setTimeout(evict, CONNECT_GIVE_UP_MS);
  const p: Promise<ApiPromise> = api.then(
    (a) => { clearTimeout(giveUp); return a; },
    (e: unknown) => { clearTimeout(giveUp); evict(); throw e; },
  );
  p.catch(() => {}); // the rejection is delivered to each waiter; this only marks it handled
  return p;
}

export function getMainnetApi(chain: ChainKey): Promise<ApiPromise> {
  let p = cache.get(chain);
  if (!p) { p = connect(chain); cache.set(chain, p); }
  return withTimeout(p, REQUEST_TIMEOUT_MS);
}

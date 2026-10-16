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

// The endpoint answered with a chain other than the configured one (a misrouted endpoint, or the genesis reset before
// this build carries the new hashes). Nothing is read from or signed against it.
export class NetworkChangedError extends Error {
  readonly chain: ChainKey;
  constructor(chain: ChainKey) { super(`unexpected genesis on ${chain}`); this.name = 'NetworkChangedError'; this.chain = chain; }
}

// Chains whose last connection answered with an unexpected genesis, for the "network changed" notice.
const changed = new Set<ChainKey>();
const listeners = new Set<() => void>();
const notify = () => { snapshot = changed.size > 0; listeners.forEach((l) => l()); };
let snapshot = false;
export const networkChanged = (): boolean => snapshot;
export function subscribeNetworkChanged(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function __setMainnetApiFactoryForTests(f?: (chain: ChainKey) => Attempt) {
  factory = f ?? realFactory;
  cache.clear();
  changed.clear(); notify();
}

function connect(chain: ChainKey): Promise<ApiPromise> {
  const { api, disconnect } = factory(chain);
  const evict = () => { if (cache.get(chain) === p) cache.delete(chain); disconnect(); };
  const giveUp = setTimeout(evict, CONNECT_GIVE_UP_MS);
  const p: Promise<ApiPromise> = api.then(
    (a) => {
      clearTimeout(giveUp);
      // Fail closed: an endpoint serving another chain is unavailable, never a chain to sign on.
      if (a.genesisHash.toHex() !== IWALLET_NETWORK.chains[chain].genesis) {
        evict();
        changed.add(chain); notify();
        throw new NetworkChangedError(chain);
      }
      if (changed.delete(chain)) notify();
      return a;
    },
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

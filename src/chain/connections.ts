import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { NETWORK, type ChainKey } from '../config/network';
import { withTimeout } from '../lib/timeout';

// How long a screen waits before showing "could not load" and a Retry button.
export const REQUEST_TIMEOUT_MS = 10_000;
// How long a connection attempt may keep trying in the background before it is abandoned.
export const CONNECT_GIVE_UP_MS = 60_000;

type Attempt = { api: Promise<ApiPromise>; disconnect: () => void };
const realFactory = (chain: ChainKey): Attempt => {
  const provider = new WsProvider([...NETWORK.chains[chain].rpc], 2_500);
  return { api: ApiPromise.create({ provider, noInitWarn: true }), disconnect: () => { void provider.disconnect(); } };
};
let factory: (chain: ChainKey) => Attempt = realFactory;

// The connection attempt is separate from the screen's wait: on a slow network the attempt keeps
// running after the screen has given up, so Retry joins the same attempt instead of starting over.
const cache = new Map<ChainKey, Promise<ApiPromise>>();

export function __setApiFactoryForTests(f?: (chain: ChainKey) => Attempt) {
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

export function getApi(chain: ChainKey): Promise<ApiPromise> {
  let p = cache.get(chain);
  if (!p) { p = connect(chain); cache.set(chain, p); }
  return withTimeout(p, REQUEST_TIMEOUT_MS);
}

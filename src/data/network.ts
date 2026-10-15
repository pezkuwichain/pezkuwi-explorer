import { encodeAddress } from '@pezkuwi/util-crypto';
import { getApi as realGetApi, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { NETWORK, type ChainKey } from '../config/network';
import { withTimeout } from '../lib/timeout';

// Verified against the live Asset Hub: treasury.palletId is "py/trsry", so the
// account is "modl" + palletId, zero-padded to 32 bytes.
const TREASURY = (() => {
  const id = new Uint8Array(32);
  id.set(new TextEncoder().encode('modlpy/trsry'));
  return encodeAddress(id, NETWORK.ss58);
})();

type Num = { toNumber(): number };
type Api = {
  query: {
    timestamp: { now(): Promise<Num> };
    session: { validators(): Promise<unknown[]> };
    referenda?: { referendumInfoFor: { entries(): Promise<[{ args: [Num] }, { unwrap(): { isOngoing: boolean } }][]> } };
    system: { account(a: string): Promise<{ data: { free: { toBigInt(): bigint } } }> };
  };
};

// About 15 relay blocks: tolerates ordinary phone clock skew, and a device clock
// behind the chain reads live.
export const LIVE_WINDOW_MS = 90_000;

// null = could not load; each field fails on its own so one down chain greys out only its card.
export type NetworkOverview = {
  live: boolean | null;
  validators: number | null;
  votes: { chain: ChainKey; index: number }[] | null;
  treasury: bigint | null;
};

const settled = async <T>(p: Promise<T>): Promise<T | null> => {
  try { return await p; } catch { return null; }
};

export async function loadNetwork(deps = { getApi: realGetApi, now: () => Date.now() }): Promise<NetworkOverview> {
  const chains: ChainKey[] = ['relay', 'assetHub', 'people'];
  const api = (c: ChainKey) => deps.getApi(c) as never as Promise<Api>;
  const q = <T>(c: ChainKey, f: (a: Api) => Promise<T>) =>
    settled(withTimeout(api(c).then(f), REQUEST_TIMEOUT_MS));

  const [ts, validators, treasury, ...refs] = await Promise.all([
    q('relay', (a) => a.query.timestamp.now()),
    q('relay', (a) => a.query.session.validators()),
    q('assetHub', (a) => a.query.system.account(TREASURY)),
    ...chains.map((c) => q(c, async (a) => (await (a.query.referenda?.referendumInfoFor.entries() ?? Promise.resolve([])))
      .filter(([, v]) => v.unwrap().isOngoing)
      .map(([k]) => ({ chain: c, index: k.args[0].toNumber() })))),
  ]);
  return {
    live: ts ? deps.now() - ts.toNumber() < LIVE_WINDOW_MS : null,
    validators: validators ? validators.length : null,
    votes: refs.every((r) => r !== null) ? refs.flat() : null,
    treasury: treasury ? treasury.data.free.toBigInt() : null,
  };
}

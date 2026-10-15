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

export async function loadNetwork(deps = { getApi: realGetApi, now: () => Date.now() }) {
  const chains: ChainKey[] = ['relay', 'assetHub', 'people'];
  const apis = (await Promise.all(chains.map((c) => deps.getApi(c)))) as never as Api[];
  const [relay, ah] = apis;
  const [ts, vals, treasury, ...refs] = await withTimeout(Promise.all([
    relay.query.timestamp.now(),
    relay.query.session.validators(),
    ah.query.system.account(TREASURY),
    ...apis.map((a) => a.query.referenda?.referendumInfoFor.entries() ?? Promise.resolve([])),
  ]), REQUEST_TIMEOUT_MS) as [Num, unknown[], Awaited<ReturnType<Api['query']['system']['account']>>, ...Awaited<ReturnType<NonNullable<Api['query']['referenda']>['referendumInfoFor']['entries']>>[]];
  const votes = refs.flatMap((entries, i) =>
    entries.filter(([, v]) => v.unwrap().isOngoing).map(([k]) => ({ chain: chains[i], index: k.args[0].toNumber() })));
  return { live: deps.now() - ts.toNumber() < 30_000, validators: vals.length, votes, treasury: treasury.data.free.toBigInt() };
}

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadNetwork } from './network';

const NOW = 1_800_000_000_000;
const fake = (chain: string) => Promise.resolve({
  query: {
    timestamp: { now: () => Promise.resolve({ toNumber: () => (chain === 'relay' ? NOW - 6_000 : NOW) }) },
    session: { validators: () => Promise.resolve(new Array(4)) },
    referenda: { referendumInfoFor: { entries: () => Promise.resolve(
      chain === 'assetHub' ? [[{ args: [{ toNumber: () => 3 }] }, { unwrap: () => ({ isOngoing: true }) }],
                               [{ args: [{ toNumber: () => 2 }] }, { unwrap: () => ({ isOngoing: false }) }]] : []) } },
    system: { account: () => Promise.resolve({ data: { free: { toBigInt: () => 99n } } }) },
  },
}) as never;

describe('loadNetwork', () => {
  it('reports liveness, validators, ongoing votes and treasury', async () => {
    const r = await loadNetwork({ getApi: fake, now: () => NOW });
    expect(r).toEqual({ live: true, validators: 4, votes: [{ chain: 'assetHub', index: 3 }], treasury: 99n });
  });
  it('reports not live when the last relay timestamp is older than 30 s', async () => {
    const r = await loadNetwork({ getApi: fake, now: () => NOW + 60_000 });
    expect(r.live).toBe(false);
  });
});

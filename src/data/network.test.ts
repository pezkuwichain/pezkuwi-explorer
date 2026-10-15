// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadLiveness, loadNetwork } from './network';

const NOW = 1_800_000_000_000;
const fakeApi = (chain: string) => ({
  query: {
    timestamp: { now: () => Promise.resolve({ toNumber: () => (chain === 'relay' ? NOW - 6_000 : NOW) }) },
    session: { validators: () => Promise.resolve(new Array(4)) },
    referenda: { referendumInfoFor: { entries: () => Promise.resolve(
      chain === 'assetHub' ? [[{ args: [{ toNumber: () => 3 }] }, { unwrap: () => ({ isOngoing: true }) }],
                               [{ args: [{ toNumber: () => 2 }] }, { unwrap: () => ({ isOngoing: false }) }]] : []) } },
    system: { account: () => Promise.resolve({ data: { free: { toBigInt: () => 99n } } }) },
  },
}) as never;
const fake = (chain: string) => Promise.resolve(fakeApi(chain));
const failing = (...down: string[]) => (chain: string) => (down.includes(chain) ? Promise.reject(new Error('down')) : fake(chain)) as never;

describe('loadNetwork', () => {
  it('reports liveness, validators, ongoing votes and treasury', async () => {
    const r = await loadNetwork({ getApi: fake, now: () => NOW });
    expect(r).toEqual({ live: true, validators: 4, votes: [{ chain: 'assetHub', index: 3 }], treasury: 99n });
  });
  it('reports live up to 90 s behind and not live beyond it', async () => {
    expect((await loadNetwork({ getApi: fake, now: () => NOW + 54_000 })).live).toBe(true); // 60 s behind
    expect((await loadNetwork({ getApi: fake, now: () => NOW + 114_000 })).live).toBe(false); // 120 s behind
  });
  it('reads live when the device clock is behind the chain', async () => {
    expect((await loadNetwork({ getApi: fake, now: () => NOW - 300_000 })).live).toBe(true);
  });
  it('keeps other fields when the people chain is down', async () => {
    const r = await loadNetwork({ getApi: failing('people'), now: () => NOW });
    expect(r).toEqual({ live: true, validators: 4, votes: null, treasury: 99n });
  });
  it('nulls treasury and votes when the asset hub is down', async () => {
    const r = await loadNetwork({ getApi: failing('assetHub'), now: () => NOW });
    expect(r).toEqual({ live: true, validators: 4, votes: null, treasury: null });
  });
  it('nulls live and validators when the relay is down', async () => {
    const r = await loadNetwork({ getApi: failing('relay'), now: () => NOW });
    expect(r.live).toBeNull();
    expect(r.validators).toBeNull();
    expect(r.treasury).toBe(99n);
  });
});

describe('loadLiveness', () => {
  it('asks only the relay chain', async () => {
    const asked: string[] = [];
    const r = await loadLiveness({ getApi: (c: string) => { asked.push(c); return fake(c); }, now: () => NOW } as never);
    expect(r).toBe(true);
    expect(asked).toEqual(['relay']);
  });
  it('uses the same 90 s window', async () => {
    expect(await loadLiveness({ getApi: fake, now: () => NOW + 54_000 } as never)).toBe(true);
    expect(await loadLiveness({ getApi: fake, now: () => NOW + 114_000 } as never)).toBe(false);
  });
  it('is null when the relay cannot be read', async () => {
    expect(await loadLiveness({ getApi: failing('relay'), now: () => NOW } as never)).toBeNull();
  });
  it('is unaffected by the other chains being down', async () => {
    expect(await loadLiveness({ getApi: failing('assetHub', 'people'), now: () => NOW } as never)).toBe(true);
  });
});

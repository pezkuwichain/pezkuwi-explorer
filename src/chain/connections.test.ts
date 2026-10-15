// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setApiFactoryForTests, CONNECT_GIVE_UP_MS, getApi, REQUEST_TIMEOUT_MS } from './connections';
import { TimeoutError } from '../lib/timeout';

type Deferred = { promise: Promise<never>; resolve(v: unknown): void; reject(e: unknown): void };
const deferred = (): Deferred => {
  let resolve!: (v: unknown) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; }) as Promise<never>;
  return { promise, resolve, reject };
};

let attempts: Deferred[]; let disconnects: number;
beforeEach(() => {
  vi.useFakeTimers();
  attempts = []; disconnects = 0;
  __setApiFactoryForTests(() => {
    const d = deferred(); attempts.push(d);
    return { api: d.promise, disconnect: () => { disconnects++; } };
  });
});
afterEach(() => { __setApiFactoryForTests(); vi.useRealTimers(); });

describe('getApi', () => {
  it('a UI wait times out at 10 s but the attempt keeps running and Retry reuses it', async () => {
    const first = getApi('relay');
    const check = expect(first).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await check;
    expect(attempts).toHaveLength(1);
    expect(disconnects).toBe(0);

    const api = { name: 'relay api' };
    attempts[0].resolve(api);
    await expect(getApi('relay')).resolves.toBe(api);
    expect(attempts).toHaveLength(1);
  });

  it('a Retry while the attempt is still running waits on the same attempt', async () => {
    const one = getApi('relay').catch(() => 'timed out');
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await one).toBe('timed out');
    const two = getApi('relay');
    const api = { name: 'late' };
    attempts[0].resolve(api);
    await expect(two).resolves.toBe(api);
    expect(attempts).toHaveLength(1);
  });

  it('a rejected creation is evicted and disconnected, so the next call starts afresh', async () => {
    const p = getApi('people');
    attempts[0].reject(new Error('refused'));
    await expect(p).rejects.toThrow('refused');
    expect(disconnects).toBe(1);
    void getApi('people').catch(() => {});
    expect(attempts).toHaveLength(2);
  });

  it('gives up after the hard cap: disconnects and the next call starts afresh', async () => {
    void getApi('assetHub').catch(() => {});
    await vi.advanceTimersByTimeAsync(CONNECT_GIVE_UP_MS - 1);
    expect(disconnects).toBe(0);
    void getApi('assetHub').catch(() => {});
    expect(attempts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(disconnects).toBe(1);
    void getApi('assetHub').catch(() => {});
    expect(attempts).toHaveLength(2);
  });

  it('keeps one connection per chain', async () => {
    void getApi('relay').catch(() => {}); void getApi('people').catch(() => {});
    expect(attempts).toHaveLength(2);
  });
});

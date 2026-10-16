// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { __setMainnetApiFactoryForTests, getMainnetApi } from './chain';
import { IWALLET_NETWORK, IWALLET_SIGNED_EXTENSIONS } from '../config/iwallet-network';
import { CONNECT_GIVE_UP_MS } from '../chain/connections';
import type { ChainKey } from '../config/network';

type Deferred = { promise: Promise<never>; resolve(v: unknown): void; reject(e: unknown): void };
const deferred = (): Deferred => {
  let resolve!: (v: unknown) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; }) as Promise<never>;
  return { promise, resolve, reject };
};

let attempts: Deferred[]; let requested: ChainKey[]; let disconnects: number;
beforeEach(() => {
  vi.useFakeTimers();
  attempts = []; requested = []; disconnects = 0;
  __setMainnetApiFactoryForTests((chain) => {
    const d = deferred(); attempts.push(d); requested.push(chain);
    return { api: d.promise, disconnect: () => { disconnects++; } };
  });
});
afterEach(() => { __setMainnetApiFactoryForTests(); vi.useRealTimers(); });

describe('getMainnetApi', () => {
  it('reuses the cached attempt for the same chain', async () => {
    const a = getMainnetApi('assetHub'); const b = getMainnetApi('assetHub');
    expect(attempts).toHaveLength(1);
    const api = { name: 'ah' };
    attempts[0].resolve(api);
    await expect(a).resolves.toBe(api);
    await expect(b).resolves.toBe(api);
  });

  it('keeps one connection per chain', () => {
    void getMainnetApi('relay').catch(() => {}); void getMainnetApi('people').catch(() => {});
    expect(requested).toEqual(['relay', 'people']);
  });

  it('evicts and disconnects a failed attempt, so the next call starts afresh', async () => {
    const p = getMainnetApi('people');
    attempts[0].reject(new Error('refused'));
    await expect(p).rejects.toThrow('refused');
    expect(disconnects).toBe(1);
    void getMainnetApi('people').catch(() => {});
    expect(attempts).toHaveLength(2);
  });

  it('gives up after the hard cap', async () => {
    void getMainnetApi('relay').catch(() => {});
    await vi.advanceTimersByTimeAsync(CONNECT_GIVE_UP_MS);
    expect(disconnects).toBe(1);
  });
});

describe('IWALLET_NETWORK', () => {
  it('carries the measured mainnet genesis hashes and the People para id', () => {
    expect(IWALLET_NETWORK.chains.relay.genesis).toBe('0x1aa94987791a5544e9667ec249d2cef1b8fdd6083c85b93fc37892d54a1156ca');
    expect(IWALLET_NETWORK.chains.assetHub.genesis).toBe('0xe7c15092dcbe3f320260ddbbc685bfceed9125a3b3d8436db2766201dec3b949');
    expect(IWALLET_NETWORK.chains.people.genesis).toBe('0x69a8d025ab7b63363935d7d9397e0f652826c94271c1bc55c4fdfe72cccf1cfa');
    expect(IWALLET_NETWORK.xcm.peopleParaId).toBe(1004);
  });

  it('hands the mainnet RPC URLs to the connection factory', () => {
    for (const k of ['relay', 'assetHub', 'people'] as const) void getMainnetApi(k).catch(() => {});
    expect(requested).toEqual(['relay', 'assetHub', 'people']);
    expect(IWALLET_NETWORK.chains.relay.rpc).toEqual(['wss://rpc.pezkuwichain.io']);
    expect(IWALLET_NETWORK.chains.assetHub.rpc).toEqual(['wss://asset-hub-rpc.pezkuwichain.io']);
    expect(IWALLET_NETWORK.chains.people.rpc).toEqual(['wss://people-rpc.pezkuwichain.io']);
  });

  it('declares both custom signed extensions with empty extrinsic and payload', () => {
    expect(IWALLET_SIGNED_EXTENSIONS).toEqual({
      AuthorizeCall: { extrinsic: {}, payload: {} },
      StorageWeightReclaim: { extrinsic: {}, payload: {} },
    });
  });

  it('every mainnet RPC origin is a token of the deployed connect-src', () => {
    const conf = readFileSync(process.env.CSP_CONF ?? 'deploy/nginx-explorer.conf', 'utf8');
    const line = conf.split('\n').find((l) => /^\s*add_header\s+Content-Security-Policy\b/.test(l))!;
    const directive = line.split(';').map((d) => d.trim().replace(/^.*?"/, '')).find((d) => d.startsWith('connect-src '))!;
    const tokens = new Set(directive.split(/\s+/).slice(1));
    for (const c of Object.values(IWALLET_NETWORK.chains)) for (const u of c.rpc) expect(tokens.has(u)).toBe(true);
  });
});

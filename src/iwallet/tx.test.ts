import { describe, expect, it, vi } from 'vitest';
import type { ApiPromise } from '@pezkuwi/api';
import type { KeyringPair } from '@pezkuwi/keyring/types';
import { ERROR_KEYS } from './errors';
import en from '../i18n/locales/en.json';
import {
  LARGE_HEZ, buildTransfer, estimateFee, friendlyError, isNodeRefusal, maxSendable, needsLargeAck, submit, tokenInfo, type SubmitEvent,
} from './tx';

const T = 10n ** 12n;
const call = (method: string) => vi.fn((...args: unknown[]) => ({ method, args }));
const stubApi = () => {
  const api = {
    tx: { balances: { transferKeepAlive: call('balances.transferKeepAlive') }, assets: { transfer: call('assets.transfer') } },
    registry: { findMetaError: vi.fn(() => ({ section: 'identityKyc', name: 'ApplicationAlreadyExists' })) },
  };
  return api;
};
const asApi = (a: unknown) => a as ApiPromise;

describe('buildTransfer', () => {
  it('sends HEZ with transferKeepAlive on Asset Hub', () => {
    const api = stubApi();
    const tx = buildTransfer(asApi(api), 'HEZ', '5Dest', 7n) as unknown as { method: string };
    expect(tx.method).toBe('balances.transferKeepAlive');
    expect(api.tx.balances.transferKeepAlive).toHaveBeenCalledWith('5Dest', 7n);
    expect(api.tx.assets.transfer).not.toHaveBeenCalled();
  });
  it('sends PEZ as asset 1 and USDT as asset 1000', () => {
    const api = stubApi();
    buildTransfer(asApi(api), 'PEZ', '5Dest', 8n);
    buildTransfer(asApi(api), 'USDT', '5Dest', 9n);
    expect(api.tx.assets.transfer).toHaveBeenNthCalledWith(1, 1, '5Dest', 8n);
    expect(api.tx.assets.transfer).toHaveBeenNthCalledWith(2, 1000, '5Dest', 9n);
    expect(api.tx.balances.transferKeepAlive).not.toHaveBeenCalled();
  });
  it('knows each token decimals from the network config', () => {
    expect([tokenInfo('HEZ').decimals, tokenInfo('PEZ').decimals, tokenInfo('USDT').decimals]).toEqual([12, 12, 6]);
  });
});

describe('estimateFee', () => {
  it('is the partialFee of paymentInfo for the signer', async () => {
    const paymentInfo = vi.fn(() => Promise.resolve({ partialFee: { toBigInt: () => 123n } }));
    expect(await estimateFee({ paymentInfo } as never, '5Me')).toBe(123n);
    expect(paymentInfo).toHaveBeenCalledWith('5Me');
  });
  it('is null when the node cannot price the call', async () => {
    expect(await estimateFee({ paymentInfo: () => Promise.reject(new Error('rpc')) } as never, '5Me')).toBeNull();
  });
});

describe('maxSendable', () => {
  it('keeps the fee and the existential deposit for HEZ', () => {
    expect(maxSendable(5n * T, 2_000_000_000n, 3_333_333n, 'HEZ')).toBe(5n * T - 2_000_000_000n - 3_333_333n);
  });
  it('floors HEZ at zero', () => {
    expect(maxSendable(1_000n, 5_000n, 3_333_333n, 'HEZ')).toBe(0n);
  });
  it('is the whole balance for assets, whatever the fee', () => {
    expect(maxSendable(3_000_000n, 9n * T, 3_333_333n, 'USDT')).toBe(3_000_000n);
    expect(maxSendable(2n * T, 9n * T, 3_333_333n, 'PEZ')).toBe(2n * T);
  });
});

describe('the large-amount gate', () => {
  it('does not trigger at exactly 1000 HEZ and does one TYR above', () => {
    expect(needsLargeAck('HEZ', 1000n * T)).toBe(false);
    expect(needsLargeAck('HEZ', 1000n * T + 1n)).toBe(true);
    expect(LARGE_HEZ).toBe(1000n * T);
  });
  it('never applies to USDT or PEZ', () => {
    expect(needsLargeAck('USDT', 5000n * 1_000_000n)).toBe(false);
    expect(needsLargeAck('USDT', 10n ** 15n)).toBe(false);
    expect(needsLargeAck('PEZ', 50_000n * T)).toBe(false);
  });
  it('has nothing to gate while the amount is unparsed', () => {
    expect(needsLargeAck('HEZ', null)).toBe(false);
  });
});

describe('friendlyError', () => {
  const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k);
  const mod = { isModule: true, asModule: {} } as never;
  it('maps identityKyc.ApplicationAlreadyExists to its i18n key', () => {
    expect(friendlyError(asApi(stubApi()), mod, t)).toBe('iwallet.err.identityKyc.ApplicationAlreadyExists');
  });
  it('names an unknown module error', () => {
    const api = stubApi();
    api.registry.findMetaError.mockReturnValue({ section: 'foo', name: 'Bar' });
    expect(friendlyError(asApi(api), mod, t)).toBe('iwallet.send.failedNamed|{"name":"foo.Bar"}');
  });
  it('uses the generic message for a non-module error', () => {
    expect(friendlyError(asApi(stubApi()), { isModule: false } as never, t)).toBe('iwallet.error.generic');
  });
  it('has English text behind every mapped key', () => {
    const get = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);
    for (const key of Object.values(ERROR_KEYS)) expect(typeof get(key), key).toBe('string');
  });
});

const res = (over: Record<string, unknown>, events: unknown[] = [{ event: { section: 'system', method: 'ExtrinsicSuccess' } }], internalError?: unknown) => ({
  events, internalError, dispatchError: undefined, txHash: { toHex: () => '0xhash' },
  status: { isInBlock: false, isFinalized: false, isDropped: false, isInvalid: false, isUsurped: false, isFinalityTimeout: false, ...over },
});
const pairStub = () => ({ lock: vi.fn() }) as unknown as KeyringPair & { lock: ReturnType<typeof vi.fn> };

describe('submit', () => {
  it('signs, locks the pair before sending, and reports in block then finalized', async () => {
    const order: string[] = [];
    const pair = pairStub();
    pair.lock.mockImplementation(() => { order.push('lock'); });
    const tx = {
      signAsync: vi.fn(() => { order.push('sign'); return Promise.resolve(); }),
      send: vi.fn((cb: (r: unknown) => void) => {
        order.push('send');
        cb(res({ isInBlock: true, asInBlock: { toHex: () => '0xb1' } }));
        cb(res({ isFinalized: true, asFinalized: { toHex: () => '0xb2' } }));
        return Promise.resolve(() => order.push('unsub'));
      }),
    };
    const events: SubmitEvent[] = [];
    await submit(tx as never, pair, (e) => events.push(e));
    expect(order).toEqual(['sign', 'lock', 'send', 'unsub']);
    expect(events).toEqual([
      { type: 'submitted' }, { type: 'inBlock', blockHash: '0xb1' }, { type: 'finalized', blockHash: '0xb2', extrinsicHash: '0xhash' },
    ]);
  });
  it('reports a dispatch error as failed and stops', async () => {
    const dispatchError = { isModule: true };
    const tx = {
      signAsync: () => Promise.resolve(),
      send: (cb: (r: unknown) => void) => { cb({ ...res({ isInBlock: true, asInBlock: { toHex: () => '0xb1' } }), dispatchError }); return Promise.resolve(() => undefined); },
    };
    const events: SubmitEvent[] = [];
    await submit(tx as never, pairStub(), (e) => events.push(e));
    expect(events).toEqual([{ type: 'submitted' }, { type: 'failed', dispatchError }]);
  });
  it('locks the pair even when signing fails, and rejects', async () => {
    const pair = pairStub();
    const tx = { signAsync: () => Promise.reject(new Error('bad')), send: vi.fn() };
    await expect(submit(tx as never, pair, () => undefined)).rejects.toThrow('bad');
    expect(pair.lock).toHaveBeenCalled();
    expect(tx.send).not.toHaveBeenCalled();
  });
  it('is not a success when the finalized result has no ExtrinsicSuccess or its events could not be read', async () => {
    for (const [events, internalError] of [[[], undefined], [[], new Error('events')], [[{ event: { section: 'system', method: 'ExtrinsicFailed' } }], undefined]] as const) {
      const tx = {
        signAsync: () => Promise.resolve(),
        send: (cb: (r: unknown) => void) => { cb(res({ isFinalized: true, asFinalized: { toHex: () => '0xb2' } }, [...events], internalError)); return Promise.resolve(() => undefined); },
      };
      const seen: SubmitEvent[] = [];
      await submit(tx as never, pairStub(), (e) => seen.push(e));
      expect(seen).toEqual([{ type: 'submitted' }, { type: 'unknown' }]);
    }
  });
  it('reports hand-off before the node answers, so a later rejection is known to be uncertain', async () => {
    const seen: SubmitEvent[] = [];
    const tx = { signAsync: () => Promise.resolve(), send: () => Promise.reject(new Error('ws closed')) };
    await expect(submit(tx as never, pairStub(), (e) => seen.push(e))).rejects.toThrow('ws closed');
    expect(seen).toEqual([{ type: 'submitted' }]);
  });
  it('turns a finality timeout into a terminal slow event', async () => {
    const tx = {
      signAsync: () => Promise.resolve(),
      send: (cb: (r: unknown) => void) => {
        cb(res({ isInBlock: true, asInBlock: { toHex: () => '0xb1' } }));
        cb(res({ isFinalityTimeout: true }));
        return Promise.resolve(() => undefined);
      },
    };
    const seen: SubmitEvent[] = [];
    await submit(tx as never, pairStub(), (e) => seen.push(e));
    expect(seen.at(-1)).toEqual({ type: 'slow', inBlock: true });
  });
  // "Nothing was sent" only when it is proven: Invalid / Usurped before any block. A drop, or anything after a block,
  // may still complete.
  it('maps pool exits: dropped and post-block exits are unknown, invalid before a block is dropped', async () => {
    const run = async (inBlockFirst: boolean, flag: 'isDropped' | 'isInvalid' | 'isUsurped') => {
      const tx = {
        signAsync: () => Promise.resolve(),
        send: (cb: (r: unknown) => void) => {
          if (inBlockFirst) cb(res({ isInBlock: true, asInBlock: { toHex: () => '0xb1' } }));
          cb(res({ [flag]: true }));
          return Promise.resolve(() => undefined);
        },
      };
      const seen: SubmitEvent[] = [];
      await submit(tx as never, pairStub(), (e) => seen.push(e));
      return seen.at(-1);
    };
    for (const flag of ['isDropped', 'isInvalid', 'isUsurped'] as const) expect(await run(true, flag)).toEqual({ type: 'unknown' });
    expect(await run(false, 'isDropped')).toEqual({ type: 'unknown' });
    expect(await run(false, 'isInvalid')).toEqual({ type: 'dropped' });
    expect(await run(false, 'isUsurped')).toEqual({ type: 'dropped' });
  });
});

describe('submit stop signal', () => {
  it('unsubscribes when the caller stops waiting, whether the subscription arrived before or after', async () => {
    for (const early of [true, false]) {
      const unsub = vi.fn();
      let resolveSend: (u: () => void) => void = () => undefined;
      const tx = {
        signAsync: () => Promise.resolve(),
        send: () => (early ? Promise.resolve(unsub) : new Promise<() => void>((r) => { resolveSend = r; })),
      };
      const ctl = new AbortController();
      const p = submit(tx as never, pairStub(), () => undefined, ctl.signal);
      await new Promise((r) => setTimeout(r, 5));
      ctl.abort();
      await p;
      if (!early) resolveSend(unsub);
      await new Promise((r) => setTimeout(r, 5));
      expect(unsub).toHaveBeenCalledTimes(1);
    }
  });
});

describe('isNodeRefusal', () => {
  it('knows the pool refusals and nothing else', () => {
    expect(isNodeRefusal({ code: 1010 })).toBe(true);
    expect(isNodeRefusal({ code: 1011 })).toBe(true);
    expect(isNodeRefusal(new Error('1014: Priority is too low'))).toBe(true);
    // Temporarily banned / already imported: the transaction may be in the pool, so it is not a proven refusal.
    expect(isNodeRefusal({ code: 1012 })).toBe(false);
    expect(isNodeRefusal(new Error('1013: Transaction Already Imported'))).toBe(false);
    expect(isNodeRefusal(new Error('WebSocket is not connected'))).toBe(false);
    expect(isNodeRefusal(new Error('Request timed out'))).toBe(false);
  });
});

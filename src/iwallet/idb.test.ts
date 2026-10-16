// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdbStore } from './idb';

// A hand-written IndexedDB double: just enough surface for idb.ts, with switches for the failure modes.
type Mode = 'ok' | 'requestError' | 'blockedThenSuccess';
function fakeFactory(mode: Mode) {
  const log = { closed: 0, txCompletes: 0 };
  const db = {
    close: () => { log.closed++; },
    createObjectStore: () => undefined,
    transaction() {
      const tx: Record<string, unknown> = { error: null };
      const mkReq = (result: unknown) => {
        const r: Record<string, unknown> = { result, error: null };
        queueMicrotask(() => {
          if (mode === 'requestError') {
            r.error = new Error('quota');
            tx.error = r.error;
            (r.onerror as () => void)?.();
            (tx.onerror as () => void)?.();
            (tx.onabort as () => void)?.();
          } else {
            (r.onsuccess as () => void)?.();
            queueMicrotask(() => { log.txCompletes++; (tx.oncomplete as () => void)?.(); });
          }
        });
        return r;
      };
      tx.objectStore = () => ({ get: (k: string) => mkReq(`v:${k}`), put: () => mkReq(undefined), delete: () => mkReq(undefined) });
      return tx;
    },
  };
  const factory = {
    open() {
      const r: Record<string, unknown> = { result: db, error: null };
      queueMicrotask(() => {
        if (mode === 'blockedThenSuccess') {
          (r.onblocked as () => void)?.();
          queueMicrotask(() => (r.onsuccess as () => void)?.());
        } else {
          (r.onupgradeneeded as () => void)?.();
          (r.onsuccess as () => void)?.();
        }
      });
      return r;
    },
  } as unknown as IDBFactory;
  return { factory, log };
}

const unhandled: unknown[] = [];
const onUnhandled = (e: unknown) => { unhandled.push(e); };
afterEach(() => { process.off('unhandledRejection', onUnhandled); unhandled.length = 0; vi.restoreAllMocks(); });

describe('idb store', () => {
  it('reads, writes and closes the handle', async () => {
    const { factory, log } = fakeFactory('ok');
    const s = createIdbStore(() => factory);
    expect(await s.get('a')).toBe('v:a');
    await s.set('a', 1); await s.deleteMany!(['a', 'b']);
    await s.setMany({ a: 1, b: 2 }, ['c']);
    expect(log.closed).toBe(4);
  });
  it('a failed request rejects once with no unhandled rejection', async () => {
    process.on('unhandledRejection', onUnhandled);
    const { factory, log } = fakeFactory('requestError');
    await expect(createIdbStore(() => factory).set('a', 1)).rejects.toThrow('quota');
    await new Promise((r) => setTimeout(r, 20));
    expect(unhandled).toEqual([]);
    expect(log.closed).toBe(1);
  });
  it('rejects when IndexedDB is unavailable', async () => {
    await expect(createIdbStore(() => undefined).get('a')).rejects.toThrow('unavailable');
  });
  it('closes a handle that arrives after a blocked rejection', async () => {
    const { factory, log } = fakeFactory('blockedThenSuccess');
    await expect(createIdbStore(() => factory).get('a')).rejects.toThrow('blocked');
    await new Promise((r) => setTimeout(r, 5));
    expect(log.closed).toBe(1);
  });
});

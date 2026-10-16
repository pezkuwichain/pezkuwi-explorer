// A tiny promise wrapper over one IndexedDB object store. The backend is injectable so tests
// can use a Map; the real one talks to `indexedDB` (database `pezkuwi-iwallet`, store `iwallet`).
export interface KvStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  // Removes every key in one transaction: all of them go, or none do.
  deleteMany(keys: string[]): Promise<void>;
  // Writes every entry and removes every key of `remove` in ONE readwrite transaction: all of it lands, or none of it.
  setMany(entries: Record<string, unknown>, remove?: string[]): Promise<void>;
}

const DB_NAME = 'pezkuwi-iwallet';
const STORE = 'iwallet';

const request = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });

const openDb = (factory: IDBFactory | undefined): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!factory) { reject(new Error('IndexedDB is unavailable')); return; }
    let settled = false;
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
    open.onsuccess = () => {
      // A handle that arrives after we gave up would otherwise stay open forever.
      if (settled) { open.result.close(); return; }
      settled = true;
      resolve(open.result);
    };
    open.onerror = () => { if (settled) return; settled = true; reject(open.error ?? new Error('IndexedDB open failed')); };
    open.onblocked = () => { if (settled) return; settled = true; reject(new Error('IndexedDB open blocked')); };
  });

// Opens per operation: a long-lived handle can be closed under us when Safari evicts storage.
async function withStore<T>(
  factory: IDBFactory | undefined,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>[],
): Promise<T | undefined> {
  const db = await openDb(factory);
  try {
    const tx = db.transaction(STORE, mode);
    // The completion handlers go on before fn runs: a synchronous throw from fn then still finds them attached, and
    // the abort it causes cannot reject a promise nobody observes.
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    let requests: IDBRequest<T>[];
    try { requests = fn(tx.objectStore(STORE)); } catch (e) {
      done.catch(() => undefined);
      try { tx.abort(); } catch { /* already finished */ }
      throw e;
    }
    // Observe the requests and the transaction together: a failure rejects once, never unhandled.
    const [results] = await Promise.all([Promise.all(requests.map(request)), done]);
    return results[0];
  } finally {
    db.close();
  }
}

export function createIdbStore(getFactory: () => IDBFactory | undefined): KvStore {
  return {
    get: (key) => withStore(getFactory(), 'readonly', (s) => [s.get(key)]),
    set: async (key, value) => { await withStore(getFactory(), 'readwrite', (s) => [s.put(value, key)]); },
    delete: async (key) => { await withStore(getFactory(), 'readwrite', (s) => [s.delete(key)]); },
    deleteMany: async (keys) => { await withStore(getFactory(), 'readwrite', (s) => keys.map((k) => s.delete(k))); },
    setMany: async (entries, remove = []) => {
      await withStore<unknown>(getFactory(), 'readwrite', (s) => [
        ...Object.entries(entries).map(([k, v]) => s.put(v, k) as unknown as IDBRequest<unknown>),
        ...remove.map((k) => s.delete(k) as unknown as IDBRequest<unknown>),
      ]);
    },
  };
}

export const indexedDbStore: KvStore = createIdbStore(() => (typeof indexedDB === 'undefined' ? undefined : indexedDB));

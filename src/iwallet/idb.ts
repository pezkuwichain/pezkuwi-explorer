// A tiny promise wrapper over one IndexedDB object store. The backend is injectable so tests
// can use a Map; the real one talks to `indexedDB` (database `pezkuwi-iwallet`, store `iwallet`).
export interface KvStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  // Removes every key in one transaction: all of them go, or none do. Optional so simple fakes
  // need not implement it; the real store always does.
  deleteMany?(keys: string[]): Promise<void>;
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
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    // Observe the requests and the transaction together: a failure rejects once, never unhandled.
    const [results] = await Promise.all([Promise.all(fn(tx.objectStore(STORE)).map(request)), done]);
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
  };
}

export const indexedDbStore: KvStore = createIdbStore(() => (typeof indexedDB === 'undefined' ? undefined : indexedDB));

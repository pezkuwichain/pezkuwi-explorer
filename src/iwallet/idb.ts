// A tiny promise wrapper over one IndexedDB object store. The backend is injectable so tests
// can use a Map; the real one talks to `indexedDB` (database `pezkuwi-iwallet`, store `iwallet`).
export interface KvStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = 'pezkuwi-iwallet';
const STORE = 'iwallet';

const request = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable')); return; }
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
    open.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });

// Opens per operation: a long-lived handle can be closed under us when Safari evicts storage.
async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    const result = await request(fn(tx.objectStore(STORE)));
    await done;
    return result;
  } finally {
    db.close();
  }
}

export const indexedDbStore: KvStore = {
  get: (key) => withStore('readonly', (s) => s.get(key)),
  set: async (key, value) => { await withStore('readwrite', (s) => s.put(value, key)); },
  delete: async (key) => { await withStore('readwrite', (s) => s.delete(key)); },
};

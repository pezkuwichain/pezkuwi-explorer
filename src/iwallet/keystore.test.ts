// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Keyring } from '@pezkuwi/keyring';
import { cryptoWaitReady, mnemonicToMiniSecret, sr25519PairFromSeed } from '@pezkuwi/util-crypto';
import { base64Decode } from '@pezkuwi/util-crypto';
import type { KvStore } from './idb';
import {
  CorruptKeystoreError, StorageUnavailableError, WeakPasswordError, WrongPasswordError, createKeystore, deleteKeystore, isValidMnemonic, loadKeystore, loadWords, newMnemonic,
  normaliseMnemonic, passwordStrength, quizIndices, quizOptions, saveKeystore, saveWalletAtomic, saveWords, unlock,
} from './keystore';

const mapStore = (): KvStore & { data: Map<string, unknown> } => {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => { data.set(k, v); },
    delete: async (k) => { data.delete(k); },
    deleteMany: async (ks) => { for (const k of ks) data.delete(k); },
    setMany: async (e, rm = []) => { for (const [k, v] of Object.entries(e)) data.set(k, v); for (const k of rm) data.delete(k); },
  };
};
vi.setConfig({ testTimeout: 30_000 }); // scrypt is deliberately slow, more so on a loaded runner
const PW = 'correct horse battery';

describe('mnemonics', () => {
  it('generates 12 valid words', () => {
    const m = newMnemonic();
    expect(m.split(' ')).toHaveLength(12);
    expect(isValidMnemonic(m)).toBe(true);
  });
  it('normalises whitespace and case', () => {
    const m = newMnemonic();
    expect(isValidMnemonic(`  ${m.split(' ').join('\n  ').toUpperCase()}  `)).toBe(true);
    expect(normaliseMnemonic(' A  B\tC ')).toBe('a b c');
  });
  it('rejects 13 words, misspellings and empty input', () => {
    const m = newMnemonic();
    expect(isValidMnemonic(`${m} ${m.split(' ')[0]}`)).toBe(false);
    const w = m.split(' '); w[0] = 'abandonx';
    expect(isValidMnemonic(w.join(' '))).toBe(false);
    expect(isValidMnemonic('')).toBe(false);
  });
  it('fixes the quiz at words 3, 7 and 11', () => { expect(quizIndices()).toEqual([2, 6, 10]); });
  it('quizOptions has 3 unique options including the right word', () => {
    const words = newMnemonic().split(' ');
    for (const i of quizIndices()) {
      for (let n = 0; n < 50; n++) {
        const o = quizOptions(words, i);
        expect(o).toHaveLength(3);
        expect(new Set(o).size).toBe(3);
        expect(o).toContain(words[i]);
      }
      // Extreme random values stay in range.
      for (const r of [0, 0.999999]) expect(quizOptions(words, i, () => r)).toContain(words[i]);
    }
  });
  it('quizOptions avoids duplicates when words repeat', () => {
    const words = ['a', 'a', 'b', 'a', 'c'];
    const o = quizOptions(words, 0);
    expect(new Set(o).size).toBe(o.length);
    expect(o).toContain('a');
  });
});

describe('keystore', () => {
  it('create, save, load, unlock gives the same address on ss58 42 with the name', async () => {
    const store = mapStore();
    const { address, json } = await createKeystore(newMnemonic(), PW);
    expect(json.meta.name).toBe('i-Wallet');
    expect(json.encoding.type).toEqual(expect.arrayContaining(['scrypt', 'xsalsa20-poly1305']));
    expect(await saveKeystore(json, store)).toBe(true);
    const loaded = await loadKeystore(store);
    expect(loaded).not.toBeNull();
    const pair = await unlock(loaded!, PW);
    expect(pair.address).toBe(address);
    expect(address.startsWith('5')).toBe(true);
    expect(pair.isLocked).toBe(false);
  });
  it('matches the address of the same mnemonic on a plain sr25519 ss58 42 keyring', async () => {
    await cryptoWaitReady();
    const m = newMnemonic();
    const { address } = await createKeystore(m, PW);
    expect(address).toBe(new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromMnemonic(m).address);
  });
  it('a wrong password throws WrongPasswordError', async () => {
    const { json } = await createKeystore(newMnemonic(), PW);
    await expect(unlock(json, 'not the password')).rejects.toBeInstanceOf(WrongPasswordError);
  });
  it('stores an importable, really encrypted polkadot-js keystore', async () => {
    const m = newMnemonic();
    const { json } = await createKeystore(m, PW);
    expect(json.encoding.content).toEqual(['pkcs8', 'sr25519']);
    expect(json.encoding.type).toEqual(['scrypt', 'xsalsa20-poly1305']);
    const bytes = Buffer.from(base64Decode(json.encoded));
    const { secretKey, publicKey } = sr25519PairFromSeed(mnemonicToMiniSecret(m));
    expect(bytes.includes(Buffer.from(secretKey))).toBe(false);
    expect(bytes.includes(Buffer.from(publicKey))).toBe(false);
    expect(bytes.includes(Buffer.from(mnemonicToMiniSecret(m)))).toBe(false);
  });
  it('refuses weak or empty passwords and plaintext blobs', async () => {
    const m = newMnemonic();
    await expect(createKeystore(m, '')).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(createKeystore(m, 'short')).rejects.toBeInstanceOf(WeakPasswordError);
    const store = mapStore();
    await expect(saveWords(m, '', store)).rejects.toBeInstanceOf(WeakPasswordError);
    expect(store.data.size).toBe(0);
    // A keystore / words blob that is not scrypt + xsalsa20-poly1305 is never opened.
    const { json } = await createKeystore(m, PW);
    const plain = { ...json, encoding: { ...json.encoding, type: ['none'] } } as typeof json;
    await expect(unlock(plain, '')).rejects.toBeInstanceOf(CorruptKeystoreError);
    store.data.set('words', { encoded: 'AAAA', encoding: { content: ['x'], type: ['none'], version: '3' } });
    await expect(loadWords('', store)).rejects.toBeInstanceOf(CorruptKeystoreError);
  });
  it('reports malformed data as corrupt, not as a wrong password', async () => {
    const { json } = await createKeystore(newMnemonic(), PW);
    await expect(unlock({} as typeof json, PW)).rejects.toBeInstanceOf(CorruptKeystoreError);
    const store = mapStore();
    store.data.set('words', 'garbage');
    await expect(loadWords(PW, store)).rejects.toBeInstanceOf(CorruptKeystoreError);
  });
  it('refuses a mnemonic with derivation suffixes or bad words', async () => {
    const m = newMnemonic();
    await expect(createKeystore(`${m}//hard`, PW)).rejects.toThrow('Invalid mnemonic');
    await expect(createKeystore('not a mnemonic', PW)).rejects.toThrow('Invalid mnemonic');
  });
  it('locks the temporary pair after exporting it', async () => {
    const lock = vi.spyOn(Keyring.prototype, 'addFromMnemonic');
    await createKeystore(newMnemonic(), PW);
    const pair = lock.mock.results[0].value as { isLocked: boolean };
    expect(pair.isLocked).toBe(true);
    lock.mockRestore();
  });
  it('does not mutate or retain the mnemonic', async () => {
    const m = newMnemonic();
    const a = await createKeystore(m, PW);
    const b = await createKeystore(m, PW);
    expect(a.address).toBe(b.address);
    expect(JSON.stringify(a.json)).not.toContain(m.split(' ')[0] + ' ' + m.split(' ')[1]);
  });
  it('saveKeystore returns false when the store throws', async () => {
    const { json } = await createKeystore(newMnemonic(), PW);
    const bad: KvStore = { get: async () => undefined, set: async () => { throw new Error('quota'); }, delete: async () => undefined, deleteMany: async () => undefined, setMany: async () => undefined };
    expect(await saveKeystore(json, bad)).toBe(false);
  });
  it('loadKeystore returns null only for no entry; a storage failure throws', async () => {
    expect(await loadKeystore(mapStore())).toBeNull();
    const bad: KvStore = { get: async () => { throw new Error('denied'); }, set: async () => undefined, delete: async () => undefined, deleteMany: async () => undefined, setMany: async () => undefined };
    await expect(loadKeystore(bad)).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});

describe('encrypted words', () => {
  it('round-trips under the password and fails under a wrong one', async () => {
    const store = mapStore();
    const m = newMnemonic();
    expect(await saveWords(m, PW, store)).toBe(true);
    expect(JSON.stringify(store.data.get('words'))).not.toContain(m.split(' ')[0] + ' ');
    expect(await loadWords(PW, store)).toBe(m);
    await expect(loadWords('nope nope nope', store)).rejects.toBeInstanceOf(WrongPasswordError);
  });
  it('saveWords returns false when the store throws', async () => {
    const bad: KvStore = { get: async () => undefined, set: async () => { throw new Error('x'); }, delete: async () => undefined, deleteMany: async () => undefined, setMany: async () => undefined };
    expect(await saveWords(newMnemonic(), PW, bad)).toBe(false);
  });
  it('deleteKeystore removes keystore and words', async () => {
    const store = mapStore();
    const m = newMnemonic();
    await saveKeystore((await createKeystore(m, PW)).json, store);
    await saveWords(m, PW, store);
    store.data.set('faceid', { wrapped: 'x' });
    const many = vi.spyOn(store, 'deleteMany');
    await deleteKeystore(store);
    expect(many).toHaveBeenCalledWith(['keystore', 'words', 'faceid']);
    expect(store.data.size).toBe(0);
    expect(await loadKeystore(store)).toBeNull();
  });
});

describe('passwordStrength', () => {
  it('requires length >= 8 for strength >= 2', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abcdefg')).toBe(1);
    expect(passwordStrength('abcdefgh')).toBe(2);
    expect(passwordStrength('abcdefgh12')).toBe(3);
    expect(passwordStrength('Abcdefgh12345!')).toBe(4);
  });
});

describe('saveWalletAtomic', () => {
  it('writes keystore and words together and, on replace, removes the old Face ID record in the same call', async () => {
    const store = mapStore();
    store.data.set('faceid', { old: true });
    const { json } = await createKeystore(newMnemonic(), PW);
    const spy = vi.spyOn(store, 'setMany');
    expect(await saveWalletAtomic(json, newMnemonic(), PW, true, store)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.data.has('keystore') && store.data.has('words')).toBe(true);
    expect(store.data.has('faceid')).toBe(false);
  });

  it('keeps a Face ID record when this is not a replace', async () => {
    const store = mapStore();
    store.data.set('faceid', { x: 1 });
    const { json } = await createKeystore(newMnemonic(), PW);
    await saveWalletAtomic(json, newMnemonic(), PW, false, store);
    expect(store.data.has('faceid')).toBe(true);
  });

  it('a failed transaction returns false and leaves the old wallet untouched', async () => {
    const store = mapStore();
    store.data.set('keystore', { old: 1 }); store.data.set('words', { old: 2 }); store.data.set('faceid', { old: 3 });
    store.setMany = async () => { throw new Error('quota'); };
    const { json } = await createKeystore(newMnemonic(), PW);
    expect(await saveWalletAtomic(json, newMnemonic(), PW, true, store)).toBe(false);
    expect([...store.data.entries()]).toEqual([['keystore', { old: 1 }], ['words', { old: 2 }], ['faceid', { old: 3 }]]);
  });

  it('refuses a weak password before touching storage', async () => {
    const store = mapStore();
    const spy = vi.spyOn(store, 'setMany');
    await expect(saveWalletAtomic({} as never, newMnemonic(), 'short', false, store)).rejects.toBeInstanceOf(WeakPasswordError);
    expect(spy).not.toHaveBeenCalled();
  });
});

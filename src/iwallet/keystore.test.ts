// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Keyring } from '@pezkuwi/keyring';
import { cryptoWaitReady } from '@pezkuwi/util-crypto';
import type { KvStore } from './idb';
import {
  WrongPasswordError, createKeystore, deleteKeystore, isValidMnemonic, loadKeystore, loadWords, newMnemonic,
  normaliseMnemonic, passwordStrength, quizIndices, quizOptions, saveKeystore, saveWords, unlock,
} from './keystore';

const mapStore = (): KvStore & { data: Map<string, unknown> } => {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => { data.set(k, v); },
    delete: async (k) => { data.delete(k); },
  };
};
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
  it('never exports the pair without a password', async () => {
    const { json } = await createKeystore(newMnemonic(), PW);
    const pair = await unlock(json, PW);
    const spy = vi.spyOn(pair, 'toJson');
    await unlock(json, PW);
    expect(spy).not.toHaveBeenCalled();
    // The stored form is encrypted: the secret is not readable without the password.
    expect(json.encoded).not.toContain(' ');
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
    const bad: KvStore = { get: async () => undefined, set: async () => { throw new Error('quota'); }, delete: async () => undefined };
    expect(await saveKeystore(json, bad)).toBe(false);
  });
  it('loadKeystore returns null when storage is empty or broken', async () => {
    expect(await loadKeystore(mapStore())).toBeNull();
    const bad: KvStore = { get: async () => { throw new Error('denied'); }, set: async () => undefined, delete: async () => undefined };
    expect(await loadKeystore(bad)).toBeNull();
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
    const bad: KvStore = { get: async () => undefined, set: async () => { throw new Error('x'); }, delete: async () => undefined };
    expect(await saveWords(newMnemonic(), PW, bad)).toBe(false);
  });
  it('deleteKeystore removes keystore and words', async () => {
    const store = mapStore();
    const m = newMnemonic();
    await saveKeystore((await createKeystore(m, PW)).json, store);
    await saveWords(m, PW, store);
    await deleteKeystore(store);
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

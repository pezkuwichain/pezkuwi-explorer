// Key custody for the i-Wallet browser hot wallet (spec §4). The mnemonic is never kept in
// module state, never logged and never copied; only password-encrypted material is stored.
import { Keyring } from '@pezkuwi/keyring';
import type { KeyringPair, KeyringPair$Json } from '@pezkuwi/keyring/types';
import { cryptoWaitReady, jsonDecrypt, jsonEncrypt, mnemonicGenerate, mnemonicValidate } from '@pezkuwi/util-crypto';
import type { EncryptedJson } from '@pezkuwi/util-crypto/json/types';
import { u8aToString, stringToU8a } from '@pezkuwi/util';
import { IWALLET_NETWORK } from '../config/iwallet-network';
import { indexedDbStore, type KvStore } from './idb';

const KEYSTORE_KEY = 'keystore';
const WORDS_KEY = 'words';
const WORDS_CONTENT = ['mnemonic', 'iwallet-words'];

export class WrongPasswordError extends Error {
  constructor() { super('Wrong password'); this.name = 'WrongPasswordError'; }
}

let ready: Promise<unknown> | null = null;
const waitReady = (): Promise<unknown> => (ready ??= cryptoWaitReady().catch((e) => { ready = null; throw e; }));

export const normaliseMnemonic = (m: string): string => m.trim().split(/\s+/).join(' ').toLowerCase();

export const newMnemonic = (): string => mnemonicGenerate(12);

export function isValidMnemonic(m: string): boolean {
  const n = normaliseMnemonic(m);
  if (!n) return false;
  const count = n.split(' ').length;
  if (count !== 12 && count !== 24) return false;
  try { return mnemonicValidate(n); } catch { return false; }
}

// Words 3, 7 and 11 (zero-based 2, 6, 10), fixed by the spec.
export const quizIndices = (): [2, 6, 10] => [2, 6, 10];

// Three unique options including the right word, shuffled. Decoys come from the other words.
export function quizOptions(words: string[], index: number, rand: () => number = Math.random): string[] {
  const right = words[index];
  const decoys = [...new Set(words.filter((w) => w !== right))];
  const options = [right];
  while (options.length < 3 && decoys.length) {
    options.push(decoys.splice(Math.min(decoys.length - 1, Math.floor(rand() * decoys.length)), 1)[0]);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export async function createKeystore(mnemonic: string, password: string): Promise<{ address: string; json: KeyringPair$Json }> {
  await waitReady();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: IWALLET_NETWORK.ss58 });
  const pair = keyring.addFromMnemonic(normaliseMnemonic(mnemonic), { name: 'i-Wallet' });
  const json = pair.toJson(password);
  return { address: pair.address, json };
}

export async function unlock(json: KeyringPair$Json, password: string): Promise<KeyringPair> {
  await waitReady();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: IWALLET_NETWORK.ss58 });
  const pair = keyring.createFromJson(json);
  try { pair.decodePkcs8(password); } catch { throw new WrongPasswordError(); }
  return pair;
}

export async function saveWords(mnemonic: string, password: string, store: KvStore = indexedDbStore): Promise<boolean> {
  try {
    await waitReady();
    const enc = jsonEncrypt(stringToU8a(normaliseMnemonic(mnemonic)), WORDS_CONTENT, password);
    await store.set(WORDS_KEY, enc);
    return true;
  } catch { return false; }
}

export async function loadWords(password: string, store: KvStore = indexedDbStore): Promise<string> {
  await waitReady();
  const enc = (await store.get(WORDS_KEY)) as EncryptedJson | undefined;
  if (!enc) throw new Error('No saved words');
  try { return u8aToString(jsonDecrypt(enc, password)); } catch { throw new WrongPasswordError(); }
}

export async function saveKeystore(json: KeyringPair$Json, store: KvStore = indexedDbStore): Promise<boolean> {
  try { await store.set(KEYSTORE_KEY, json); return true; } catch { return false; }
}

// null when there is no wallet or this browser has no usable storage (private mode, cleared data).
export async function loadKeystore(store: KvStore = indexedDbStore): Promise<KeyringPair$Json | null> {
  try { return ((await store.get(KEYSTORE_KEY)) as KeyringPair$Json | undefined) ?? null; } catch { return null; }
}

export async function deleteKeystore(store: KvStore = indexedDbStore): Promise<void> {
  await store.delete(KEYSTORE_KEY);
  await store.delete(WORDS_KEY);
}

export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) === true; } catch { return false; }
}

// 0 empty, 1 too short, 2 acceptable (>= 8), 3 good, 4 strong.
export function passwordStrength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  if (p.length < 8) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length >= 14 && classes >= 3) return 4;
  if (p.length >= 10 && classes >= 2) return 3;
  return 2;
}

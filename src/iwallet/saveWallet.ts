// Saves a new or imported wallet in one all-or-nothing step (spec §4): the keystore and the encrypted words are both
// written, or neither is kept. Used by the create and import screens.
import type { KeyringPair, KeyringPair$Json } from '@pezkuwi/keyring/types';
import { createKeystore, deleteKeystore, requestPersistence, saveKeystore, saveWords, unlock } from './keystore';
import { enrolFaceId, forgetFaceId } from './faceid';

export class NotSavedError extends Error {
  constructor() { super('The wallet could not be saved'); this.name = 'NotSavedError'; }
}

export interface SavedWallet {
  json: KeyringPair$Json;
  pair: KeyringPair;
  /** i18n key of a non-blocking note when Face ID could not be set up; the wallet exists regardless. */
  note: 'iwallet.faceid.cancelled' | 'iwallet.faceid.unavailable' | null;
}

export async function saveWallet(
  mnemonic: string,
  password: string,
  opts: { faceId: boolean; replacing: boolean },
): Promise<SavedWallet> {
  const { json } = await createKeystore(mnemonic, password);
  if (!(await saveKeystore(json))) throw new NotSavedError();
  if (!(await saveWords(mnemonic, password))) {
    // Nothing half-saved: the keystore is removed again so no wallet exists without its recovery words.
    await deleteKeystore().catch(() => undefined);
    throw new NotSavedError();
  }
  // A replaced wallet must not keep the old wallet's Face ID password.
  if (opts.replacing) await forgetFaceId().catch(() => false);
  await requestPersistence();
  let note: SavedWallet['note'] = null;
  if (opts.faceId) {
    const r = await enrolFaceId(password);
    if (!r.ok) note = r.reason === 'cancelled' ? 'iwallet.faceid.cancelled' : 'iwallet.faceid.unavailable';
  }
  const pair = await unlock(json, password);
  return { json, pair, note };
}

// Saves a new or imported wallet in one all-or-nothing step (spec §4): the keystore, the encrypted words and, on a
// replace, the removal of the old Face ID record land in a single IndexedDB transaction. A failure changes nothing,
// so an existing wallet is never damaged. Used by the create and import screens.
import type { KeyringPair$Json } from '@pezkuwi/keyring/types';
import { createKeystore, requestPersistence, saveWalletAtomic } from './keystore';
import { enrolFaceId } from './faceid';
import { withKeyProgress } from './progress';

export class NotSavedError extends Error {
  constructor() { super('The wallet could not be saved'); this.name = 'NotSavedError'; }
}

export interface SavedWallet { json: KeyringPair$Json }

export async function saveWallet(mnemonic: string, password: string, opts: { replacing: boolean }): Promise<SavedWallet> {
  // Both steps run scrypt with the password (the keystore, then the words): the overlay covers them.
  const json = await withKeyProgress(async () => {
    const { json: j } = await createKeystore(mnemonic, password);
    if (!(await saveWalletAtomic(j, mnemonic, password, opts.replacing))) throw new NotSavedError();
    return j;
  });
  await requestPersistence();
  // No decrypted pair comes back: the wallet opens unlocked, and each signature decrypts its own pair.
  return { json };
}

export type FaceIdNote = 'iwallet.faceid.cancelled' | 'iwallet.faceid.unavailable' | 'iwallet.faceid.storage';

// Face ID enrolment is its own step: iOS Safari wants a fresh tap for WebAuthn, not a call chained after scrypt.
export async function enableFaceId(password: string): Promise<{ ok: true } | { ok: false; note: FaceIdNote; retry: boolean }> {
  const r = await enrolFaceId(password);
  if (r.ok) return { ok: true };
  if (r.reason === 'cancelled') return { ok: false, note: 'iwallet.faceid.cancelled', retry: true };
  return { ok: false, note: r.reason === 'storage' ? 'iwallet.faceid.storage' : 'iwallet.faceid.unavailable', retry: false };
}

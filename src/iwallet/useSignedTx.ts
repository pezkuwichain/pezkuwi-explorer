import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import { CorruptKeystoreError, WrongPasswordError, unlock as decrypt } from './keystore';
import { useIWallet } from './IWalletContext';
import { friendlyError, submit, type SubmitEvent } from './tx';

// The signing step shared by the citizenship actions, with the same rule as Send (Task 7): each action decrypts a
// fresh pair from the password (or Face ID), signs, and locks that pair before waiting for the chain.

export type TxOutcome =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'inBlock' }
  | { kind: 'finalized'; hash: string }
  | { kind: 'failed'; message: string }
  | { kind: 'interrupted' };

type Tx = SubmittableExtrinsic<'promise'>;

export function useSignedTx() {
  const { t } = useTranslation();
  const { keystore } = useIWallet();
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TxOutcome>({ kind: 'idle' });
  const busyRef = useRef(false);

  // Resolves with the final outcome so the caller can follow up (reload, start polling); null when the password failed.
  const run = useCallback(async (api: ApiPromise, build: () => Tx, password: string): Promise<TxOutcome | null> => {
    if (busyRef.current || !keystore) return null;
    busyRef.current = true; setBusy(true); setAuthError(null);
    let pair;
    try {
      pair = await decrypt(keystore, password);
    } catch (err) {
      setAuthError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
      busyRef.current = false; setBusy(false);
      return null;
    }
    let last: TxOutcome = { kind: 'pending' };
    const set = (o: TxOutcome) => { last = o; setOutcome(o); };
    set({ kind: 'pending' });
    let terminal = false;
    let submitted = false;
    const onDisconnect = () => { if (!terminal && submitted) set({ kind: 'interrupted' }); };
    api.on('disconnected', onDisconnect);
    const onStatus = (ev: SubmitEvent) => {
      if (ev.type === 'submitted') submitted = true;
      else if (ev.type === 'inBlock') set({ kind: 'inBlock' });
      else if (ev.type === 'finalized') { terminal = true; set({ kind: 'finalized', hash: ev.extrinsicHash }); }
      else if (ev.type === 'failed') { terminal = true; set({ kind: 'failed', message: friendlyError(api, ev.dispatchError, t) }); }
      else if (ev.type === 'dropped') { terminal = true; set({ kind: 'failed', message: t('iwallet.send.dropped') }); }
    };
    try {
      await submit(build(), pair, onStatus);
    } catch {
      terminal = true;
      set(submitted ? { kind: 'interrupted' } : { kind: 'failed', message: t('iwallet.error.generic') });
    } finally {
      try { pair.lock(); } catch { /* already locked */ }
      api.off('disconnected', onDisconnect);
      busyRef.current = false; setBusy(false);
    }
    return last;
  }, [keystore, t]);

  const reset = useCallback(() => { setOutcome({ kind: 'idle' }); setAuthError(null); }, []);
  return { busy, authError, setAuthError, outcome, run, reset };
}

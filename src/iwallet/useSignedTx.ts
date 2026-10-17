import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import { CorruptKeystoreError, WrongPasswordError, unlock as decrypt } from './keystore';
import { useHoldOpen, useIWallet } from './IWalletContext';
import { withKeyProgress } from './progress';
import { finalityReader, friendlyError, isNodeRefusal, submit, type SubmitEvent } from './tx';

// The signing step shared by the citizenship actions, with the same rule as Send (Task 7): each action decrypts a
// fresh pair from the password (or Face ID), signs, and locks that pair before waiting for the chain.

export type TxOutcome =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'inBlock' }
  | { kind: 'finalized'; hash: string; blockHash: string }
  // In a block, but the node stopped waiting for finality: final confirmation is slow.
  | { kind: 'slow' }
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
  // The running attempt's status subscription and finality watcher, ended when the screen goes away.
  const live = useRef<AbortController | null>(null);
  useEffect(() => () => live.current?.abort(), []);
  // From the first decrypt to leaving the result, an auto-lock must not swap this screen for the unlock form: the
  // attempt carries on regardless, and its outcome (no secret in it) is what tells the person whether money left.
  useHoldOpen(busy || outcome.kind !== 'idle');

  // Resolves with the final outcome so the caller can follow up (reload, start polling); null when the password failed.
  const run = useCallback(async (api: ApiPromise, build: () => Tx, password: string): Promise<TxOutcome | null> => {
    if (busyRef.current || !keystore) return null;
    busyRef.current = true; setBusy(true); setAuthError(null);
    let pair;
    try {
      pair = await withKeyProgress('sign', () => decrypt(keystore, password));
    } catch (err) {
      setAuthError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
      busyRef.current = false; setBusy(false);
      return null;
    }
    let last: TxOutcome = { kind: 'pending' };
    const set = (o: TxOutcome) => { last = o; setOutcome(o); };
    set({ kind: 'pending' });
    let terminal = false;
    let handedOff = false;
    // Once the extrinsic may have left this device, a lost connection means "unknown", never "failed".
    let onDisconnect: () => void = () => undefined;
    // Ends the status subscription when the disconnect wins the race, so it cannot report into a finished attempt.
    const stop = new AbortController();
    live.current = stop;
    const disconnected = new Promise<'disconnected'>((resolve) => {
      onDisconnect = () => { if (!terminal && handedOff) { terminal = true; set({ kind: 'interrupted' }); stop.abort(); resolve('disconnected'); } };
    });
    api.on('disconnected', onDisconnect);
    const onStatus = (ev: SubmitEvent) => {
      if (terminal) return;
      if (ev.type === 'submitted') handedOff = true;
      else if (ev.type === 'inBlock') set({ kind: 'inBlock' });
      else if (ev.type === 'finalized') { terminal = true; set({ kind: 'finalized', hash: ev.extrinsicHash, blockHash: ev.blockHash }); }
      else if (ev.type === 'failed') { terminal = true; set({ kind: 'failed', message: friendlyError(api, ev.dispatchError, t) }); }
      else if (ev.type === 'dropped') { terminal = true; set({ kind: 'failed', message: t('iwallet.send.dropped') }); }
      else if (ev.type === 'unknown') { terminal = true; set({ kind: 'interrupted' }); }
      else if (ev.type === 'slow') { terminal = true; set(ev.inBlock ? { kind: 'slow' } : { kind: 'interrupted' }); }
    };
    try {
      await Promise.race([submit(build(), pair, onStatus, stop.signal, finalityReader(api)), disconnected]);
    } catch (err) {
      // Only a failure before hand-off, or a refusal by the node's pool, proves nothing was sent.
      if (!terminal) {
        terminal = true;
        set(handedOff && !isNodeRefusal(err) ? { kind: 'interrupted' } : { kind: 'failed', message: t('iwallet.error.generic') });
      }
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

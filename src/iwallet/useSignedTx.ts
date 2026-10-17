import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import { CorruptKeystoreError, WrongPasswordError, unlock as decrypt } from './keystore';
import { useHoldOpen, useIWallet } from './IWalletContext';
import { nextPaint } from './progress';
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

/** What the progress overlay says while an action is under way: decrypting and signing, handing it to the network,
 *  then waiting for finality once a block has it. */
export type TxPhase = 'signing' | 'sending' | 'inBlock';
/** How long the overlay holds the person before it offers to carry on in the background. */
export const BACKGROUND_AFTER_MS = 8_000;

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
  // One overlay from the password to a final answer (TxProgress). Hiding it cancels nothing: the result screen
  // behind keeps following the attempt.
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const [hidden, setHidden] = useState(false);
  const [canHide, setCanHide] = useState(false);
  const authFailed = useRef(false);
  const onChain = phase === 'sending' || phase === 'inBlock';
  // Counted once from the hand-off (not again at the block); reset when the next attempt starts.
  useEffect(() => {
    if (!onChain) return;
    const timer = setTimeout(() => setCanHide(true), BACKGROUND_AFTER_MS);
    return () => clearTimeout(timer);
  }, [onChain]);

  // Resolves with the final outcome so the caller can follow up (reload, start polling); null when the password failed.
  const run = useCallback(async (api: ApiPromise, build: () => Tx, password: string): Promise<TxOutcome | null> => {
    if (busyRef.current || !keystore) return null;
    busyRef.current = true; setBusy(true); setAuthError(null);
    authFailed.current = false; setHidden(false); setCanHide(false); setPhase('signing');
    let pair;
    try {
      // The overlay is painted before scrypt takes the main thread.
      await nextPaint();
      pair = await decrypt(keystore, password);
    } catch (err) {
      authFailed.current = true;
      setAuthError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
      setPhase(null);
      busyRef.current = false; setBusy(false);
      return null;
    }
    let last: TxOutcome = { kind: 'pending' };
    // Every outcome past "in a block" is final for the overlay: it closes and the result screen tells the rest.
    const set = (o: TxOutcome) => {
      last = o; setOutcome(o);
      if (o.kind === 'inBlock') setPhase('inBlock'); else if (o.kind !== 'pending') setPhase(null);
    };
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
      if (ev.type === 'submitted') { handedOff = true; setPhase('sending'); }
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
      setPhase(null);
      busyRef.current = false; setBusy(false);
    }
    return last;
  }, [keystore, t]);

  const reset = useCallback(() => { setOutcome({ kind: 'idle' }); setAuthError(null); }, []);
  const hide = useCallback(() => setHidden(true), []);
  const failed = useCallback(() => authFailed.current, []);
  /** The overlay to show now, or null: its step, whether it may be hidden yet, and how. */
  const progress = phase && !hidden ? { phase, canHide, hide, failed } : null;
  return { busy, authError, setAuthError, outcome, run, reset, progress };
}

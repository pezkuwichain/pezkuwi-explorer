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
  // In a block; `likelyFailed` when that block's events carry an error for it (not final until the block is).
  | { kind: 'inBlock'; likelyFailed?: boolean }
  | { kind: 'finalized'; hash: string; blockHash: string }
  // In a block, but final confirmation is slow. Still watched for a while: a later final answer replaces it.
  | { kind: 'slow'; likelyFailed?: boolean }
  | { kind: 'failed'; message: string }
  // The result is not known (it may still complete); `disconnected` when the connection to the node dropped.
  | { kind: 'interrupted'; disconnected?: boolean };

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
  // The running attempt, from the confirm on: leaving the screen aborts it. Before the hand-off that means nothing is
  // sent; after it, only the waiting stops (status subscription, finality watcher).
  const live = useRef<AbortController | null>(null);
  useEffect(() => () => live.current?.abort(), []);
  // Which attempt may still report: a newer one, or "send another", silences an older one still watching after "slow".
  const attempt = useRef(0);
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

  // Resolves with the first settled outcome (final, or slow); null when the password failed or the attempt was
  // abandoned before anything was sent. A slow attempt keeps being watched and a later final answer replaces it, but the
  // person is free to start another (busy is released). `onSettled` runs for every settled outcome, the late final one
  // included, so the caller's follow-ups (reload, start polling) see it too.
  const run = useCallback(async (
    api: ApiPromise, build: () => Tx, password: string, onSettled?: (o: TxOutcome) => void,
  ): Promise<TxOutcome | null> => {
    if (busyRef.current || !keystore) return null;
    live.current?.abort(); // an older attempt still watching after "slow"
    const id = ++attempt.current;
    const mine = () => attempt.current === id;
    const stop = new AbortController();
    live.current = stop;
    busyRef.current = true; setBusy(true); setAuthError(null);
    authFailed.current = false; setHidden(false); setCanHide(false); setPhase('signing');
    const release = () => { if (mine()) { busyRef.current = false; setBusy(false); } };
    let pair;
    try {
      // The overlay is painted before scrypt takes the main thread.
      await nextPaint();
      if (stop.signal.aborted) { if (mine()) setPhase(null); release(); return null; }
      pair = await decrypt(keystore, password);
    } catch (err) {
      authFailed.current = true;
      if (mine()) {
        setAuthError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
        setPhase(null);
      }
      release();
      return null;
    }
    // Left while the key was opening: nothing is signed or sent.
    if (stop.signal.aborted) { try { pair.lock(); } catch { /* already locked */ } if (mine()) setPhase(null); release(); return null; }
    let last: TxOutcome = { kind: 'pending' };
    let settle: (o: TxOutcome | null) => void = () => undefined;
    const settled = new Promise<TxOutcome | null>((r) => { settle = r; });
    // Every outcome past "in a block" settles the attempt: the overlay closes and the result screen tells the rest.
    // Once settled (slow), only a final answer changes the screen: a later block (after a retraction) neither reopens
    // the overlay nor turns "slow" back into "in a block"; it only updates the likely-failed mark.
    let settledOnce = false;
    let likely = false;
    const slowNow = (): TxOutcome => (likely ? { kind: 'slow', likelyFailed: true } : { kind: 'slow' });
    const set = (o: TxOutcome) => {
      if (!mine()) return;
      if (o.kind === 'inBlock') {
        likely = o.likelyFailed === true;
        if (settledOnce) { last = slowNow(); setOutcome(last); return; }
        last = o; setOutcome(o); setPhase('inBlock');
        return;
      }
      last = o; setOutcome(o);
      if (o.kind !== 'pending') { setPhase(null); release(); settle(o); settledOnce = true; onSettled?.(o); }
    };
    set({ kind: 'pending' });
    let terminal = false;
    let handedOff = false;
    // Once the extrinsic may have left this device, a lost connection means "unknown", never "failed".
    let onDisconnect: () => void = () => undefined;
    // Ends the status subscription when the disconnect wins the race, so it cannot report into a finished attempt.
    const disconnected = new Promise<'disconnected'>((resolve) => {
      onDisconnect = () => { if (!terminal && handedOff) { terminal = true; set({ kind: 'interrupted', disconnected: true }); stop.abort(); resolve('disconnected'); } };
    });
    api.on('disconnected', onDisconnect);
    const onStatus = (ev: SubmitEvent) => {
      if (terminal) return;
      if (ev.type === 'submitted') { handedOff = true; if (mine()) setPhase('sending'); }
      else if (ev.type === 'inBlock') set(ev.likelyFailed ? { kind: 'inBlock', likelyFailed: true } : { kind: 'inBlock' });
      else if (ev.type === 'finalized') { terminal = true; set({ kind: 'finalized', hash: ev.extrinsicHash, blockHash: ev.blockHash }); }
      else if (ev.type === 'failed') { terminal = true; set({ kind: 'failed', message: friendlyError(api, ev.dispatchError, t) }); }
      else if (ev.type === 'dropped') { terminal = true; set({ kind: 'failed', message: t('iwallet.send.dropped') }); }
      else if (ev.type === 'unknown') { terminal = true; set({ kind: 'interrupted' }); }
      // Slow after a block is not the end: the watcher may still bring the answer. Without a block it is.
      else if (ev.type === 'slow') { if (ev.inBlock) set(slowNow()); else { terminal = true; set({ kind: 'interrupted' }); } }
    };
    void (async () => {
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
        if (mine()) setPhase(null);
        release();
        // Abandoned before the hand-off: nothing was sent.
        settle(handedOff ? last : null);
      }
    })();
    return settled;
  }, [keystore, t]);

  // Leaving a result. An attempt still watched after "slow" is let go (nothing left to cancel: it was sent).
  const reset = useCallback(() => {
    if (!busyRef.current) { live.current?.abort(); attempt.current++; }
    setOutcome({ kind: 'idle' }); setAuthError(null);
  }, []);
  const hide = useCallback(() => setHidden(true), []);
  const failed = useCallback(() => authFailed.current, []);
  /** The overlay to show now, or null: its step, whether it may be hidden yet, and how. */
  const likelyFailed = outcome.kind === 'inBlock' && outcome.likelyFailed === true;
  const progress = phase && !hidden ? { phase, likelyFailed, canHide, hide, failed } : null;
  return { busy, authError, setAuthError, outcome, run, reset, progress };
}

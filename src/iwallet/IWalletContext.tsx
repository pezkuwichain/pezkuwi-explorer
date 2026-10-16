// The i-Wallet session (spec §4/§5): whether a keystore exists, whether it is unlocked, and the unlocked
// signing pair. The pair is held in memory only and dropped (and locked) on every lock path.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { KeyringPair, KeyringPair$Json } from '@pezkuwi/keyring/types';
import { deleteKeystore, loadKeystore, unlock as decrypt } from './keystore';
import { unlockWithFaceId } from './faceid';
import { indexedDbStore, type KvStore } from './idb';

export type IWalletState = 'loading' | 'none' | 'locked' | 'unlocked' | 'unavailable';

export interface IWalletValue {
  state: IWalletState;
  address: string | null;
  pair: KeyringPair | null;
  /** Throws WrongPasswordError / CorruptKeystoreError; the state stays 'locked' then. */
  unlock(password: string): Promise<void>;
  /** Unlocks with the stored Face ID password; a cancelled prompt leaves the wallet locked, silently. */
  unlockFaceId(): Promise<void>;
  lock(): void;
  /** A wallet was just created or imported and saved: adopt it as unlocked. */
  setCreated(json: KeyringPair$Json, pair: KeyringPair): void;
  /** Deletes the stored wallet and returns to 'none'. */
  remove(): Promise<void>;
}

export const IDLE_LOCK_MS = 5 * 60_000;
export const HIDDEN_LOCK_MS = 60_000;

const Ctx = createContext<IWalletValue | null>(null);

export function IWalletProvider({ children, store = indexedDbStore }: { children: ReactNode; store?: KvStore }) {
  const [state, setState] = useState<IWalletState>('loading');
  const [json, setJson] = useState<KeyringPair$Json | null>(null);
  const [pair, setPair] = useState<KeyringPair | null>(null);
  const pairRef = useRef<KeyringPair | null>(null);
  const jsonRef = useRef<KeyringPair$Json | null>(null);

  // Drops the pair from memory; the keyring pair is also locked so its secret key is wiped.
  const drop = useCallback(() => {
    try { pairRef.current?.lock(); } catch { /* already locked */ }
    pairRef.current = null;
    setPair(null);
  }, []);

  useEffect(() => {
    let live = true;
    loadKeystore(store).then(
      (j) => {
        if (!live) return;
        jsonRef.current = j; setJson(j); setState(j ? 'locked' : 'none');
      },
      () => { if (live) setState('unavailable'); },
    );
    return () => { live = false; };
  }, [store]);

  const adopt = useCallback((p: KeyringPair) => { pairRef.current = p; setPair(p); setState('unlocked'); }, []);

  const unlock = useCallback(async (password: string) => {
    const j = jsonRef.current;
    if (!j) return;
    adopt(await decrypt(j, password));
  }, [adopt]);

  const unlockFaceId = useCallback(async () => {
    const j = jsonRef.current;
    if (!j) return;
    const pw = await unlockWithFaceId(store);
    if (pw === null) return;
    adopt(await decrypt(j, pw));
  }, [adopt, store]);

  const lock = useCallback(() => {
    drop();
    setState((s) => (s === 'unlocked' ? 'locked' : s));
  }, [drop]);

  const setCreated = useCallback((j: KeyringPair$Json, p: KeyringPair) => {
    jsonRef.current = j; setJson(j); adopt(p);
  }, [adopt]);

  const remove = useCallback(async () => {
    await deleteKeystore(store);
    drop();
    jsonRef.current = null; setJson(null); setState('none');
  }, [drop, store]);

  // Auto-lock: 5 minutes without pointer or key activity, or 60 seconds with the page hidden.
  useEffect(() => {
    if (state !== 'unlocked') return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let hidden: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { clearTimeout(idle); idle = setTimeout(lock, IDLE_LOCK_MS); };
    const onVisibility = () => {
      clearTimeout(hidden);
      if (document.hidden) hidden = setTimeout(lock, HIDDEN_LOCK_MS); else arm();
    };
    const events = ['pointerdown', 'pointermove', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    arm();
    if (document.hidden) onVisibility();
    return () => {
      clearTimeout(idle); clearTimeout(hidden);
      events.forEach((e) => window.removeEventListener(e, arm));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state, lock]);

  const value = useMemo<IWalletValue>(() => ({
    state, address: json?.address ?? null, pair, unlock, unlockFaceId, lock, setCreated, remove,
  }), [state, json, pair, unlock, unlockFaceId, lock, setCreated, remove]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIWallet(): IWalletValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useIWallet must be used inside IWalletProvider');
  return v;
}

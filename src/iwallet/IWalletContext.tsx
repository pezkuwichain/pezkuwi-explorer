// The i-Wallet session (spec §4/§5): whether a keystore exists and whether it is unlocked. No decrypted key is kept
// here: unlocking only proves the password (the pair it decrypts is locked at once), and every signature decrypts a
// fresh pair of its own (useSignedTx). "Unlocked" therefore means "may show the wallet", never "holds the secret".
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { KeyringPair$Json } from '@pezkuwi/keyring/types';
import { withKeyProgress } from './progress';
import { indexedDbStore, type KvStore } from './idb';
import { clearAllForms, clearForm, clearTeleportSent } from './personal-store';

// The provider is always mounted (App.tsx) but the keyring, the crypto WASM and Face ID load only when a wallet call
// needs them, together with the i-Wallet screens; the explorer's own screens never load them.
const keystore = () => import('./keystore');
const faceid = () => import('./faceid');

// 'loadFailed': the wallet's own code (loaded on demand) did not arrive, e.g. offline in a tab older than a deploy; it is
// not a storage problem, and retryLoad() tries again.
export type IWalletState = 'idle' | 'loading' | 'none' | 'locked' | 'unlocked' | 'unavailable' | 'loadFailed';

export interface IWalletValue {
  state: IWalletState;
  /** Starts reading the stored keystore (once). Nothing touches IndexedDB before this is called. */
  ensureLoaded(): void;
  /** After 'loadFailed': imports the wallet code again and reads the stored keystore. */
  retryLoad(): void;
  address: string | null;
  /** The stored encrypted keystore (public JSON, safe to export). */
  keystore: KeyringPair$Json | null;
  /** Decrypts the stored backup words with the password; throws WrongPasswordError / CorruptKeystoreError. */
  readWords(password: string): Promise<string>;
  /** Throws WrongPasswordError / CorruptKeystoreError; the state stays 'locked' then. */
  unlock(password: string): Promise<void>;
  /** Unlocks with the stored Face ID password; a cancelled prompt leaves the wallet locked, silently. */
  unlockFaceId(): Promise<void>;
  lock(): void;
  /** A wallet was just created or imported and saved: adopt it as unlocked. */
  setCreated(json: KeyringPair$Json): void;
  /** Deletes the stored wallet and the personal data kept for it, and returns to 'none'. */
  remove(): Promise<void>;
  /** True while a screen holds a signing attempt or its result: a lock then keeps that screen (it holds no secret). */
  holdOpen: boolean;
  /** Registers (true) or releases (false) one hold; see useHoldOpen. */
  setHold(on: boolean): void;
}

export const IDLE_LOCK_MS = 5 * 60_000;
export const HIDDEN_LOCK_MS = 60_000;

const Ctx = createContext<IWalletValue | null>(null);

export function IWalletProvider({ children, store = indexedDbStore, loadCode = keystore }: {
  children: ReactNode; store?: KvStore;
  /** The on-demand keystore module (tests pass a failing one). */
  loadCode?: typeof keystore;
}) {
  const [state, setState] = useState<IWalletState>('idle');
  const [json, setJson] = useState<KeyringPair$Json | null>(null);
  const jsonRef = useRef<KeyringPair$Json | null>(null);
  const [holds, setHolds] = useState(0);

  const started = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const ensureLoaded = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setState('loading');
    loadCode().then(
      (k) => k.loadKeystore(store).then(
        (j) => {
          if (!live.current) return;
          jsonRef.current = j; setJson(j); setState(j ? 'locked' : 'none');
        },
        () => { if (live.current) setState('unavailable'); },
      ),
      // The code itself did not load: say so and allow another try (not "this browser cannot store a wallet").
      () => { started.current = false; if (live.current) setState('loadFailed'); },
    );
  }, [store, loadCode]);
  const retryLoad = useCallback(() => { if (!started.current) ensureLoaded(); }, [ensureLoaded]);

  const unlock = useCallback(async (password: string) => {
    const j = jsonRef.current;
    if (!j) return;
    const { verifyPassword } = await keystore();
    await withKeyProgress('open', () => verifyPassword(j, password));
    setState('unlocked');
  }, []);

  const unlockFaceId = useCallback(async () => {
    const j = jsonRef.current;
    if (!j) return;
    const pw = await (await faceid()).unlockWithFaceId(store);
    if (pw === null) return;
    const { verifyPassword } = await keystore();
    await withKeyProgress('open', () => verifyPassword(j, pw));
    setState('unlocked');
  }, [store]);

  // The stored words are read first, outside the overlay (IndexedDB), then opened with the password under it.
  const readWords = useCallback(async (password: string) => {
    const { openWords, readSealedWords } = await keystore();
    const sealed = await readSealedWords(store);
    return withKeyProgress('open', () => openWords(sealed, password));
  }, [store]);

  const lock = useCallback(() => {
    setState((s) => (s === 'unlocked' ? 'locked' : s));
  }, []);

  const setCreated = useCallback((j: KeyringPair$Json) => {
    // A replaced wallet's citizenship form is personal data of a wallet that is gone from this device.
    const old = jsonRef.current;
    if (old && old.address !== j.address) { clearForm(old.address); clearTeleportSent(old.address); }
    jsonRef.current = j; setJson(j); setState('unlocked');
  }, []);

  const remove = useCallback(async () => {
    await (await keystore()).deleteKeystore(store);
    const old = jsonRef.current;
    clearAllForms();
    if (old) clearTeleportSent(old.address);
    jsonRef.current = null; setJson(null); setState('none');
  }, [store]);

  const setHold = useCallback((on: boolean) => setHolds((n) => Math.max(0, n + (on ? 1 : -1))), []);

  // Auto-lock: 5 minutes without pointer or key activity, or 60 seconds with the page hidden. Measured by the wall
  // clock: iOS Safari suspends timers (and freezes the page) in the background, so a timer alone could fire late or be
  // cancelled by the returning page. The timer only triggers a check; the check compares timestamps, and it also runs
  // when the page shows again (visibilitychange, pageshow, focus) and before an activity counts.
  useEffect(() => {
    if (state !== 'unlocked') return;
    let lastActivityAt = Date.now();
    let hiddenAt: number | null = document.hidden ? lastActivityAt : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const overdue = (now: number) =>
      now - lastActivityAt >= IDLE_LOCK_MS || (hiddenAt !== null && now - hiddenAt >= HIDDEN_LOCK_MS);
    const schedule = () => {
      clearTimeout(timer);
      const now = Date.now();
      let due = lastActivityAt + IDLE_LOCK_MS - now;
      if (hiddenAt !== null) due = Math.min(due, hiddenAt + HIDDEN_LOCK_MS - now);
      timer = setTimeout(check, Math.max(0, due));
    };
    // true when it locked.
    function check(): boolean {
      if (overdue(Date.now())) { clearTimeout(timer); lock(); return true; }
      schedule();
      return false;
    }
    const onActivity = () => { if (!check()) { lastActivityAt = Date.now(); schedule(); } };
    const onVisibility = () => {
      if (document.hidden) { if (hiddenAt === null) hiddenAt = Date.now(); schedule(); return; }
      if (!check()) { hiddenAt = null; schedule(); }
    };
    const onShow = () => { if (!document.hidden) onVisibility(); else check(); };
    const events = ['pointerdown', 'pointermove', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', onShow);
    schedule();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [state, lock]);

  const holdOpen = holds > 0;
  const value = useMemo<IWalletValue>(() => ({
    state, ensureLoaded, retryLoad, address: json?.address ?? null, keystore: json, readWords, unlock, unlockFaceId, lock, setCreated, remove,
    holdOpen, setHold,
  }), [state, ensureLoaded, retryLoad, json, readWords, unlock, unlockFaceId, lock, setCreated, remove, holdOpen, setHold]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIWallet(): IWalletValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useIWallet must be used inside IWalletProvider');
  return v;
}

// While `active`, a lock keeps the calling screen instead of switching to the unlock form (see RequireUnlocked).
export function useHoldOpen(active: boolean): void {
  const { setHold } = useIWallet();
  useEffect(() => {
    if (!active) return;
    setHold(true);
    return () => setHold(false);
  }, [active, setHold]);
}

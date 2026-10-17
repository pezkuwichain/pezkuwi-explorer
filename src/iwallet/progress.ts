import { useSyncExternalStore } from 'react';

// The key is opened and sealed with scrypt (N = 2^17), which takes seconds on a phone. While any of that runs the
// i-Wallet shows one overlay (IWalletShell) saying what it is doing: opening the key, saving a new wallet, or signing.
// Only the password work is wrapped, never storage I/O (IndexedDB has no timeout, and a stuck transaction must not
// leave the screen covered).
export type KeyWork = 'open' | 'save' | 'sign';
const running: KeyWork[] = [];
let lastFailed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** The work the overlay is shown for (the latest started that is still running), or null. */
export const useKeyWork = (): KeyWork | null => useSyncExternalStore(subscribe, () => running.at(-1) ?? null, () => null);
/** True when the last wrapped work threw (a wrong password, say): focus then goes to the field, not the button. */
export const lastKeyWorkFailed = (): boolean => lastFailed;

// Lets the browser paint (the overlay) before the main thread is taken: a frame, or a short timeout when frames do
// not run (a background tab).
const nextPaint = () => new Promise<void>((resolve) => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 50);
});

// Runs `work` (a password decrypt or encrypt) with the overlay shown for `reason`.
export async function withKeyProgress<T>(reason: KeyWork, work: () => Promise<T>): Promise<T> {
  running.push(reason); notify();
  try {
    await nextPaint();
    const v = await work();
    lastFailed = false;
    return v;
  } catch (e) {
    lastFailed = true;
    throw e;
  } finally {
    running.splice(running.lastIndexOf(reason), 1); notify();
  }
}

import { useSyncExternalStore } from 'react';

// The key is opened with scrypt (N = 2^17), which takes seconds on a phone. While any open or save is running the
// i-Wallet shows one overlay (IWalletShell); this counts the running ones.
let running = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useDecrypting = (): boolean => useSyncExternalStore(subscribe, () => running > 0);

// Lets the browser paint (the overlay) before the main thread is taken: a frame, or a short timeout when frames do
// not run (a background tab).
const nextPaint = () => new Promise<void>((resolve) => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 50);
});

// Runs `work` (a password decrypt or encrypt) with the overlay shown.
export async function withKeyProgress<T>(work: () => Promise<T>): Promise<T> {
  running++; notify();
  try {
    await nextPaint();
    return await work();
  } finally {
    running--; notify();
  }
}

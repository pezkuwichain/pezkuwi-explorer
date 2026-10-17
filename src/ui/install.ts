// "Add to Home Screen". Chromium (Android) fires beforeinstallprompt once the page qualifies as an installable PWA,
// possibly before React has rendered anything, so main.tsx starts listening first and the event is kept here until a
// button asks for it. iOS Safari has no such API: there the button explains the Share-sheet steps instead.

// The Chromium event (not in the DOM typings).
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeInstall(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Starts listening (once). The browser's own mini-infobar is suppressed: the page offers its own button.
export function startInstallCapture(win: Window = window): void {
  if (started) return;
  started = true;
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  // Installed (from our button or the browser menu): nothing left to offer.
  win.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

/** True while the browser has handed over an install prompt that has not been used yet. */
export const canPrompt = (): boolean => deferred !== null;

// Shows the browser's install dialog. An event can be prompted only once, so it is dropped either way; Chromium
// fires a fresh one later if the person dismissed it.
export async function prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  notify();
  try {
    await e.prompt();
    return (await e.userChoice).outcome;
  } catch { return 'dismissed'; }
}

// True when the page already runs from the Home Screen (installed PWA): nothing to offer then.
export function isStandalone(): boolean {
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) return true;
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

// iPhone, iPod and iPad, including iPadOS, whose Safari reports a desktop Mac (MacIntel) but has a touch screen.
export function isIos(nav: Navigator = navigator): boolean {
  try {
    if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
    return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
  } catch { return false; }
}

// For tests: forget a captured event and allow capturing again.
export function resetInstallForTests(): void { deferred = null; started = false; notify(); }

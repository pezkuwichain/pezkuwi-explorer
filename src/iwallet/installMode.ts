import { useSyncExternalStore } from 'react';
import { canPrompt, isIos, isStandalone, subscribeInstall } from '../ui/install';
import { WALLET_CLASS, isWalletBrowser } from '../ui/walletBrowser';

// What "Add to Home Screen" can do here: nothing when already on the Home Screen; the browser's own install dialog
// (Chromium); the Share-sheet steps (iOS, which has no API); or nothing but the hint text (any other browser).
export type InstallMode = 'standalone' | 'prompt' | 'ios' | 'none';

// In-app browsers have no Share → Add to Home Screen: the Pezkuwi Wallet's DApp browser (detected a beat after load,
// hence html.in-wallet as well) and Telegram's. There only the hint text is shown.
export function inAppBrowser(): boolean {
  try {
    if (document.documentElement.classList.contains(WALLET_CLASS) || isWalletBrowser()) return true;
    return /Telegram/i.test(navigator.userAgent || '');
  } catch { return false; }
}

export function installMode(): InstallMode {
  if (isStandalone()) return 'standalone';
  if (canPrompt()) return 'prompt';
  return isIos() && !inAppBrowser() ? 'ios' : 'none';
}

// Re-read on an install event and when html.in-wallet appears (markWalletBrowser sets it after load).
function subscribe(l: () => void): () => void {
  const off = subscribeInstall(l);
  const watch = new MutationObserver(l);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => { off(); watch.disconnect(); };
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, installMode, () => 'none');
}

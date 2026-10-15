import { isWalletBrowser, walletSettled } from '../ui/walletBrowser';

// Which ways into a wallet this device has. Ported from dks.news (site/dkn-wallet.js platform(), hasInjected(),
// routes()), which took the matrix from loto.pex.mom; both run it in production:
//   inapp    Pezkuwi Wallet's own DApp browser: it injects a provider, so the extension connector reads it.
//            Recognised by that provider's wallet-only name (ui/walletBrowser.ts), as on pex.network; the
//            PEZKUWI_MOBILE / native-bridge flags of dks.news are kept but the wallet sets neither.
//   desktop  the Pezkuwi extension when installed, and a QR for a wallet on another device
//   android  WalletConnect deep link into the wallet app on this same device
//   ios      the same deep link
// A browser extension cannot be installed on a phone and a QR cannot be scanned by the phone showing it,
// so neither is offered there.
export type Platform = 'inapp' | 'desktop' | 'android' | 'ios';
export type Route = 'extension' | 'wc-qr' | 'wc-app';


type Win = {
  PEZKUWI_MOBILE?: unknown;
  PezkuwiNativeBridge?: { signTransaction?: unknown };
  injectedWeb3?: Record<string, unknown>;
};

export function platform(): Platform {
  const w = window as unknown as Win;
  if (w.PEZKUWI_MOBILE === true || typeof w.PezkuwiNativeBridge?.signTransaction === 'function' || isWalletBrowser()) return 'inapp';
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// Inside the wallet's browser whatever it injects counts; on a desktop only a Pezkuwi extension does.
export function hasInjected(p: Platform = platform()): boolean {
  try {
    const keys = Object.keys((window as unknown as Win).injectedWeb3 ?? {});
    if (p === 'inapp') return keys.length > 0;
    return keys.some((k) => /^pezkuwi/i.test(k));
  } catch { return false; }
}

// The wallet ways, in order; the first is the main one.
export function routes(p: Platform = platform()): Route[] {
  if (p === 'inapp') return hasInjected(p) ? ['extension'] : ['wc-app'];
  if (p === 'desktop') return hasInjected(p) ? ['extension', 'wc-qr'] : ['wc-qr'];
  return ['wc-app'];
}

export const onPhone = (p: Platform = platform()) => p !== 'desktop';

// The ways once the wallet's late injection has had its chance (see walletSettled): used when a way is taken,
// so a tap in the first moment after the wallet opens the page does not fall back to WalletConnect.
export async function settledRoutes(): Promise<Route[]> {
  await walletSettled();
  return routes();
}

// Follows the deep link into the wallet app. Its own function so tests can see it without navigating.
export function followDeepLink(href: string): void {
  try { window.location.href = href; } catch { /* the button stays on screen */ }
}

export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=io.pezkuwichain.wallet';

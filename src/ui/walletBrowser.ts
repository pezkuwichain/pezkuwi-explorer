// Whether the page runs inside the Pezkuwi Wallet's own DApp browser, ported from pex.network
// (web/src/lib/platform.js isDappWebview / useIsDappWebview). The wallet injects its provider into
// window.injectedWeb3 (feature-dapp-impl polkadotjs_min.js: 'pezkuwi-wallet', 'pezkuwi-js'), a beat after the
// page starts, so the check is repeated briefly after load. Used only to zero the bottom safe-area inset
// (html.in-wallet, see theme.css), which the wallet has already applied below the webview.
type Win = { injectedWeb3?: Record<string, unknown>; __PEZKUWI_WEBVIEW__?: unknown; PEZKUWI_MOBILE?: unknown };

export function isWalletBrowser(): boolean {
  const w = window as unknown as Win;
  const injected = w.injectedWeb3;
  if (injected && (injected['pezkuwi-wallet'] || injected['pezkuwi-js'] || injected['pezkuwi'])) return true;
  if (w.__PEZKUWI_WEBVIEW__ === true || w.PEZKUWI_MOBILE === true) return true;
  return /PezkuwiWallet|PezkuwiDApp/i.test(navigator.userAgent || '');
}

export const WALLET_CLASS = 'in-wallet';

// Marks <html> now if the wallet is already there, else checks every 150 ms up to ten times, then gives up.
export function markWalletBrowser(): void {
  const root = document.documentElement;
  if (isWalletBrowser()) { root.classList.add(WALLET_CLASS); return; }
  let tries = 0;
  const id = setInterval(() => {
    tries += 1;
    if (isWalletBrowser()) { root.classList.add(WALLET_CLASS); clearInterval(id); }
    else if (tries >= 10) clearInterval(id);
  }, 150);
}

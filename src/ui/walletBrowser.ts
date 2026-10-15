// Whether the page runs inside the Pezkuwi Wallet's own DApp browser, ported from pex.network
// (web/src/lib/platform.js isDappWebview / useIsDappWebview). The wallet injects its provider into
// window.injectedWeb3 a beat after the page starts, so the check is repeated briefly after load. Only the
// names the wallet apps alone use count, read from their injection scripts:
//   Android  feature-dapp-impl/res/raw/polkadotjs_min.js  'polkadot-js', 'pezkuwi-wallet', 'pezkuwi-js'
//   iOS      novawallet/Resources/nova_min.js              'polkadot-js', 'nova-wallet'
// The desktop Pezkuwi extension injects 'pezkuwi' (extension/src/page.ts), so neither it nor 'polkadot-js'
// may count: a desktop with the extension is not the wallet. Used to zero the bottom safe-area inset
// (html.in-wallet, see theme.css) and to sign in through the injected wallet (account/platform.ts).
type Win = { injectedWeb3?: Record<string, unknown>; __PEZKUWI_WEBVIEW__?: unknown; PEZKUWI_MOBILE?: unknown };

export const WALLET_KEYS = ['pezkuwi-wallet', 'nova-wallet'] as const;

export function isWalletBrowser(): boolean {
  const w = window as unknown as Win;
  const injected = w.injectedWeb3;
  if (injected && WALLET_KEYS.some((k) => injected[k])) return true;
  if (w.__PEZKUWI_WEBVIEW__ === true || w.PEZKUWI_MOBILE === true) return true;
  return /PezkuwiWallet|PezkuwiDApp/i.test(navigator.userAgent || '');
}

export const WALLET_CLASS = 'in-wallet';
// How long after load the wallet's injection may still land (PEX polls ten times at 150 ms).
export const WALLET_SETTLE_MS = 1500;

// Resolves once the page is known to be in the wallet, or once the settle window since load has passed.
// A page open longer than that resolves at once, so a tap in a plain browser is never delayed.
export function walletSettled(now: () => number = () => performance.now()): Promise<void> {
  return new Promise((done) => {
    const check = () => {
      if (isWalletBrowser() || now() >= WALLET_SETTLE_MS) { done(); return true; }
      return false;
    };
    if (check()) return;
    const id = setInterval(() => { if (check()) clearInterval(id); }, 150);
  });
}

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

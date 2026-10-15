import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { WALLET_CLASS, isWalletBrowser, markWalletBrowser } from './walletBrowser';

// The bottom inset goes through --sa-bottom only, and html.in-wallet zeroes it (pex.network's fix): inside the
// Pezkuwi Wallet's DApp browser the webview reports the system bar's inset although the wallet already sits the
// page above its own toolbar, so using it again leaves a band between the two bars.
const css = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? css(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []);
const theme = readFileSync('src/ui/theme.css', 'utf8');
const layout = readFileSync('src/ui/layout.css', 'utf8');

describe('bottom safe-area inset', () => {
  it('is read from env() in one place only, the --sa-bottom variable', () => {
    const uses = css('src').flatMap((f) => (readFileSync(f, 'utf8').match(/env\(safe-area-inset-bottom[^)]*\)/g) ?? []).map(() => f));
    expect(uses).toEqual(['src/ui/theme.css']);
    expect(theme).toMatch(/--sa-bottom: env\(safe-area-inset-bottom, 0px\);/);
  });

  it('is zeroed inside the wallet browser', () => {
    expect(theme).toMatch(/:root\.in-wallet \{ --sa-bottom: 0px; \}/);
  });

  it('sizes and pads the tab bar from it, with an 8px floor and no fixed allowance', () => {
    expect(theme).toMatch(/--tabbar: calc\(62px \+ max\(8px, var\(--sa-bottom\)\)\);/);
    expect(layout).toMatch(/padding: 8px 12px max\(8px, var\(--sa-bottom\)\);/);
    expect(layout).toMatch(/padding-block-end: var\(--tabbar\);/);
  });
});

describe('wallet browser detection', () => {
  afterEach(() => {
    delete (window as { injectedWeb3?: unknown }).injectedWeb3;
    document.documentElement.classList.remove(WALLET_CLASS);
    vi.useRealTimers();
  });

  it('is off in a plain browser', () => {
    expect(isWalletBrowser()).toBe(false);
  });

  it('marks the page when the wallet injects its provider after load', () => {
    vi.useFakeTimers();
    markWalletBrowser();
    expect(document.documentElement.classList.contains(WALLET_CLASS)).toBe(false);
    (window as { injectedWeb3?: unknown }).injectedWeb3 = { 'pezkuwi-wallet': {} };
    vi.advanceTimersByTime(150);
    expect(document.documentElement.classList.contains(WALLET_CLASS)).toBe(true);
  });

  it('knows the iOS wallet too, and not the desktop extension', () => {
    (window as { injectedWeb3?: unknown }).injectedWeb3 = { 'polkadot-js': {}, 'nova-wallet': {} };
    expect(isWalletBrowser()).toBe(true);
    (window as { injectedWeb3?: unknown }).injectedWeb3 = { pezkuwi: {}, 'polkadot-js': {} };
    expect(isWalletBrowser()).toBe(false);
  });

  it('gives up after ten checks', () => {
    vi.useFakeTimers();
    markWalletBrowser();
    vi.advanceTimersByTime(1500);
    (window as { injectedWeb3?: unknown }).injectedWeb3 = { 'pezkuwi-wallet': {} };
    vi.advanceTimersByTime(1500);
    expect(document.documentElement.classList.contains(WALLET_CLASS)).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { platform, routes, settledRoutes } from './platform';

const UA = {
  desktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
type W = { PEZKUWI_MOBILE?: unknown; PezkuwiNativeBridge?: unknown; injectedWeb3?: unknown };
const w = window as unknown as W;

const as = (ua: string, extra: W = {}) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  Object.assign(w, extra);
};

afterEach(() => {
  vi.restoreAllMocks();
  delete w.PEZKUWI_MOBILE; delete w.PezkuwiNativeBridge; delete w.injectedWeb3;
});

describe('wallet ways per device', () => {
  it('inside Pezkuwi Wallet (PEZKUWI_MOBILE) uses what the wallet injects', () => {
    as(UA.android, { PEZKUWI_MOBILE: true, injectedWeb3: { 'pezkuwi-wallet': {} } });
    expect(platform()).toBe('inapp');
    expect(routes()).toEqual(['extension']);
  });
  it('inside Pezkuwi Wallet (native bridge) counts any injected provider', () => {
    as(UA.ios, { PezkuwiNativeBridge: { signTransaction: () => {} }, injectedWeb3: { 'polkadot-js': {} } });
    expect(platform()).toBe('inapp');
    expect(routes()).toEqual(['extension']);
  });
  it('desktop with the Pezkuwi extension: the extension first, then the QR for another device', () => {
    as(UA.desktop, { injectedWeb3: { 'pezkuwi-js': {} } });
    expect(platform()).toBe('desktop');
    expect(routes()).toEqual(['extension', 'wc-qr']);
  });
  it('desktop without it (another extension does not count): the QR only', () => {
    as(UA.desktop, { injectedWeb3: { 'polkadot-js': {} } });
    expect(routes()).toEqual(['wc-qr']);
    delete w.injectedWeb3;
    expect(routes()).toEqual(['wc-qr']);
  });
  it('android: the deep link into the app, never an extension or a QR', () => {
    as(UA.android, { injectedWeb3: { 'pezkuwi-js': {} } });
    expect(platform()).toBe('android');
    expect(routes()).toEqual(['wc-app']);
  });
  it('ios: the deep link too', () => {
    as(UA.ios);
    expect(platform()).toBe('ios');
    expect(routes()).toEqual(['wc-app']);
  });
  // The names each wallet app injects, read from its own injection script (see ui/walletBrowser.ts).
  it('inside Pezkuwi Wallet for Android (no PEZKUWI_MOBILE): the injected wallet', () => {
    as(UA.android, { injectedWeb3: { 'polkadot-js': {}, 'pezkuwi-wallet': {}, 'pezkuwi-js': {} } });
    expect(platform()).toBe('inapp');
    expect(routes()).toEqual(['extension']);
  });
  it('inside Pezkuwi Wallet for iOS: the injected wallet', () => {
    as(UA.ios, { injectedWeb3: { 'polkadot-js': {}, 'nova-wallet': {} } });
    expect(platform()).toBe('inapp');
    expect(routes()).toEqual(['extension']);
  });
  it('the desktop extension (injected as "pezkuwi") is not the wallet: extension first, QR second', () => {
    as(UA.desktop, { injectedWeb3: { pezkuwi: {} } });
    expect(platform()).toBe('desktop');
    expect(routes()).toEqual(['extension', 'wc-qr']);
  });
});

describe('a tap right after the wallet opens the page', () => {
  afterEach(() => vi.useRealTimers());
  it('waits for the late injection instead of falling back to WalletConnect', async () => {
    vi.useFakeTimers();
    as(UA.android);
    vi.spyOn(performance, 'now').mockReturnValue(200);
    const r = settledRoutes();
    setTimeout(() => { w.injectedWeb3 = { 'pezkuwi-wallet': {} }; }, 300);
    await vi.advanceTimersByTimeAsync(450);
    expect(await r).toEqual(['extension']);
  });
  it('does not delay a tap in a plain phone browser once the page has been open a while', async () => {
    as(UA.android);
    vi.spyOn(performance, 'now').mockReturnValue(5000);
    expect(await settledRoutes()).toEqual(['wc-app']);
  });
  it('gives up at the end of the settle window', async () => {
    vi.useFakeTimers();
    as(UA.android);
    let t = 200;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    const r = settledRoutes();
    t = 1600;
    await vi.advanceTimersByTimeAsync(150);
    expect(await r).toEqual(['wc-app']);
  });
});

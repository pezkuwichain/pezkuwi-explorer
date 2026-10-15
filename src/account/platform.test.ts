import { afterEach, describe, expect, it, vi } from 'vitest';
import { platform, routes } from './platform';

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
});

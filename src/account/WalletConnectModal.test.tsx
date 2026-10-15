import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '../i18n';
import { storage } from '../lib/storage';
import { AccountProvider } from './AccountContext';
import { CONNECTED_CLOSE_MS, CONNECTION_TIMEOUT_MS, WalletConnectModal } from './WalletConnectModal';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const URI = 'wc:abc@2?relay-protocol=irn&symKey=00';
const DEEP = 'pezkuwiwallet://wc?uri=' + encodeURIComponent(URI);

// The pairing the connector hands out: its URI now, the approval when the test settles it.
const wc = vi.hoisted(() => ({
  starts: 0,
  uri: '',
  fail: null as null | Error,
  settle: null as null | { ok(a: string[]): void; no(e: unknown): void },
  followed: [] as string[],
}));
vi.mock('./connectors/walletconnect', async (orig) => {
  const real = await orig<typeof import('./connectors/walletconnect')>();
  return {
    WC_DISCONNECTED: real.WC_DISCONNECTED, WC_CONNECTED: real.WC_CONNECTED, WC_SESSION_KEY: real.WC_SESSION_KEY, deepLinkFor: real.deepLinkFor,
    disconnectWalletConnect: () => Promise.resolve(), restoreWalletConnect: () => Promise.resolve({ state: 'none' }),
    sessionPeerName: () => 'pezWallet',
    followDeepLink: (h: string) => { wc.followed.push(h); },
    startPairing: async (signal?: AbortSignal) => {
      wc.starts++;
      if (wc.fail) throw wc.fail;
      const approval = new Promise<string[]>((ok, no) => { wc.settle = { ok, no }; });
      approval.catch(() => {});
      return { uri: wc.uri, deepLink: real.deepLinkFor(wc.uri), approval: () => (signal?.aborted ? Promise.reject(new Error('aborted')) : approval) };
    },
  };
});

const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
const ui = (onClose = vi.fn()) => {
  render(<AccountProvider><WalletConnectModal isOpen onClose={onClose} /></AccountProvider>);
  return { onClose, dialog: screen.getByRole('dialog', { name: 'WalletConnect' }) };
};

describe('WalletConnectModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    Object.assign(wc, { starts: 0, uri: URI, fail: null, settle: null, followed: [] });
    setWidth(1280);
  });
  afterEach(() => { vi.useRealTimers(); setWidth(1024); });

  it('desktop: the pairing as an SVG QR, the waiting line and the how-to; never the raw wc: text, nothing followed', async () => {
    const { dialog } = ui();
    expect(dialog).toHaveAccessibleDescription('Scan with pezWallet to connect');
    const qr = await within(dialog).findByRole('img', { name: 'WalletConnect QR Code' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d/);
    expect(within(dialog).getByText('Waiting for wallet to connect...')).toBeInTheDocument();
    expect(within(dialog).getByText('Open pezWallet app → Settings → WalletConnect → Scan QR code')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('wc:');
    expect(document.querySelector('a[href^="wc:"], a[href^="pezkuwiwallet:"], img')).toBeNull();
    expect(wc.followed).toEqual([]);
  });

  it('phone: follows pezkuwiwallet://wc?uri= at once, offers Open pezWallet and the Play Store, no QR', async () => {
    setWidth(390);
    const { dialog } = ui();
    expect(dialog).toHaveAccessibleDescription('Connect with pezWallet app');
    const openApp = await within(dialog).findByRole('button', { name: 'Open pezWallet' });
    expect(wc.followed).toEqual([DEEP]);
    expect(within(dialog).getByText('Approve the connection in pezWallet')).toBeInTheDocument();
    expect(within(dialog).getByText('Waiting for wallet to connect...')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: "Don't have pezWallet? Download it on Play Store." }))
      .toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=io.pezkuwichain.wallet');
    expect(within(dialog).queryByRole('img', { name: 'WalletConnect QR Code' })).toBeNull();
    fireEvent.click(openApp);
    expect(wc.followed).toEqual([DEEP, DEEP]);
  });

  it('approved: Connected!, the wallet name and the address, then it closes after 1.5 s', async () => {
    const { dialog, onClose } = ui();
    await within(dialog).findByRole('img', { name: 'WalletConnect QR Code' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => { wc.settle!.ok([ALICE]); });
    expect(within(dialog).getByText('Connected!')).toBeInTheDocument();
    expect(within(dialog).getByText('pezWallet')).toBeInTheDocument();
    expect(within(dialog).getByText('5Grwva…GKutQY')).toBeInTheDocument();
    expect(storage.get('account')).toBe(ALICE);
    expect(storage.get('account-source')).toBe('walletconnect');
    act(() => { vi.advanceTimersByTime(CONNECTED_CLOSE_MS - 1); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a pairing that cannot start: the error and Try Again, which starts a new one', async () => {
    wc.fail = new Error('');
    const { dialog } = ui();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Connection failed');
    wc.fail = null;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try Again' }));
    expect(await within(dialog).findByRole('img', { name: 'WalletConnect QR Code' })).toBeInTheDocument();
    expect(wc.starts).toBeGreaterThanOrEqual(2);
  });

  it('times out after five minutes without an approval', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { dialog } = ui();
    // The pairing starts on promises only; let them settle without the (fake) clock moving.
    await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
    expect(within(dialog).getByRole('img', { name: 'WalletConnect QR Code' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(CONNECTION_TIMEOUT_MS - 1); });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Connection timed out. Please try again.');
    expect(within(dialog).getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('a pairing URI that is not wc: is neither shown nor followed', async () => {
    for (const w of [1280, 390]) {
      setWidth(w);
      wc.uri = 'javascript:alert(1)';
      wc.followed = [];
      const { dialog } = ui();
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Connection failed');
      expect(within(dialog).queryByRole('img', { name: 'WalletConnect QR Code' })).toBeNull();
      expect(wc.followed).toEqual([]);
      cleanup();
    }
  });
});

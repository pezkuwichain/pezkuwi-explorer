import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../i18n';
import { storage } from '../lib/storage';
import { AccountProvider, useAccount } from './AccountContext';
import { WalletModalHost } from './WalletModal';
import { NoWalletError, RejectedError } from './connectors/extension';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

const ext = vi.hoisted(() => ({ accounts: vi.fn() }));
vi.mock('./connectors/extension', async (orig) => ({ ...(await orig<typeof import('./connectors/extension')>()), extensionAccounts: ext.accounts }));
const wc = vi.hoisted(() => ({
  disconnect: vi.fn(() => Promise.resolve()),
  restore: vi.fn((): Promise<unknown> => Promise.resolve({ state: 'none' })),
}));
vi.mock('./connectors/walletconnect', () => ({
  WC_DISCONNECTED: 'wc-off', WC_CONNECTED: 'wc-on', WC_SESSION_KEY: 'wc-session',
  disconnectWalletConnect: wc.disconnect, restoreWalletConnect: wc.restore, sessionPeerName: () => 'pezWallet',
  startPairing: () => new Promise(() => {}), deepLinkFor: (u: string) => u, followDeepLink: () => {},
}));

// A button that opens the app's wallet dialog, as the home card and the address chips do.
function Opener() {
  const { openWalletModal } = useAccount();
  return <button type="button" onClick={openWalletModal}>OPEN WALLET</button>;
}
const ui = () => {
  render(<AccountProvider><Opener /><WalletModalHost /></AccountProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
  return screen.getByRole('dialog');
};
const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
const injected = (on: boolean) => {
  const w = window as unknown as { injectedWeb3?: unknown };
  if (on) w.injectedWeb3 = { 'pezkuwi-js': {} }; else delete w.injectedWeb3;
};

describe('WalletModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    setWidth(1280);
    injected(false);
    ext.accounts.mockReset();
    wc.disconnect.mockClear();
    wc.restore.mockReset().mockResolvedValue({ state: 'none' });
  });
  afterEach(() => { vi.restoreAllMocks(); injected(false); setWidth(1024); });

  it('desktop: offers the browser extension and the mobile wallet, each with its store link', () => {
    const d = ui();
    expect(within(d).getByRole('heading', { name: 'Connect Wallet' })).toBeInTheDocument();
    expect(d).toHaveAccessibleDescription('Connect your Pezkuwi.js extension to interact with PezkuwiChain');
    expect(within(d).getByRole('heading', { name: 'Browser Extension' })).toBeInTheDocument();
    expect(within(d).getByRole('heading', { name: 'Mobile Wallet' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Connect Extension' })).toBeEnabled();
    expect(within(d).getByRole('button', { name: 'Connect with pezWallet' })).toBeEnabled();
    expect(within(d).getByRole('link', { name: 'Get from Chrome Web Store' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/chromewebstore\.google\.com\/search\/pezkuwi/));
    expect(within(d).getByRole('link', { name: 'Download on Play Store' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=io.pezkuwichain.wallet');
  });

  it('a window narrower than 768 px offers the mobile wallet only', () => {
    setWidth(767);
    const d = ui();
    expect(within(d).queryByRole('heading', { name: 'Browser Extension' })).toBeNull();
    expect(within(d).queryByRole('button', { name: 'Connect Extension' })).toBeNull();
    expect(within(d).getByRole('heading', { name: 'Mobile Wallet' })).toBeInTheDocument();
  });

  it('the extension: "Approve in extension..." while it asks, then the account is selected and shown connected', async () => {
    let answer!: (a: unknown) => void;
    ext.accounts.mockReturnValue(new Promise((r) => { answer = r; }));
    const d = ui();
    fireEvent.click(within(d).getByRole('button', { name: 'Connect Extension' }));
    const busy = await within(d).findByRole('button', { name: 'Approve in extension...' });
    expect(busy).toBeDisabled();
    await act(async () => { answer([{ address: ALICE, name: 'Alice', source: 'pezkuwi-js' }]); });
    expect(within(d).getByRole('heading', { name: 'Wallet Connected' })).toBeInTheDocument();
    expect(within(d).getByText('Alice')).toBeInTheDocument();
    expect(within(d).getByTitle(ALICE)).toHaveTextContent('5Grwva…GKutQY');
    expect(within(d).getByText('pezkuwi-js')).toBeInTheDocument();
    expect(storage.get('account')).toBe(ALICE);
    expect(storage.get('account-source')).toBe('extension');
    // One account: no switch list.
    expect(within(d).queryByText('Switch Account')).toBeNull();
  });

  it('an extension that is installed but did not authorise: the authorise message and Try Again', async () => {
    injected(true);
    ext.accounts.mockRejectedValue(new NoWalletError());
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const d = ui();
    fireEvent.click(within(d).getByRole('button', { name: 'Connect Extension' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Please authorize the connection in your Pezkuwi Wallet extension');
    expect(open).not.toHaveBeenCalled();
    ext.accounts.mockResolvedValue([{ address: ALICE, name: 'Alice', source: 'pezkuwi-js' }]);
    fireEvent.click(within(d).getByRole('button', { name: 'Try Again' }));
    expect(await within(d).findByRole('heading', { name: 'Wallet Connected' })).toBeInTheDocument();
  });

  it('no extension installed: the not-found message, the Chrome Web Store opened and offered, and the after-install hint', async () => {
    ext.accounts.mockRejectedValue(new NoWalletError());
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const d = ui();
    fireEvent.click(within(d).getByRole('button', { name: 'Connect Extension' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Pezkuwi Wallet extension not found. Please install from Chrome Web Store.');
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/chromewebstore\.google\.com\//), '_blank', 'noopener,noreferrer');
    expect(within(d).getByRole('link', { name: 'Install from Chrome Web Store' })).toHaveAttribute('target', '_blank');
    expect(within(d).getByText('After installing, refresh the page and try again')).toBeInTheDocument();
  });

  it('any other error: its message and Try Again, which asks the extension again', async () => {
    ext.accounts.mockRejectedValue(new RejectedError());
    const d = ui();
    fireEvent.click(within(d).getByRole('button', { name: 'Connect Extension' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('No accounts found. Please create an account in Pezkuwi.js extension');
    ext.accounts.mockRejectedValue(new Error('Extension exploded'));
    fireEvent.click(within(d).getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(within(d).getByRole('alert')).toHaveTextContent('Extension exploded'));
    expect(ext.accounts).toHaveBeenCalledTimes(2);
  });

  it('connected over WalletConnect: address with copy, the source with the wallet name, and Disconnect', async () => {
    storage.set('account', ALICE);
    storage.set('account-source', 'walletconnect');
    wc.restore.mockResolvedValue({ state: 'live', accounts: [ALICE], peerName: 'pezWallet' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const d = ui();
      expect(within(d).getByRole('heading', { name: 'Wallet Connected' })).toBeInTheDocument();
      expect(await within(d).findByText('WalletConnect (pezWallet)')).toBeInTheDocument();
      expect(within(d).getByTitle(ALICE)).toHaveTextContent('5Grwva…GKutQY');
      await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Copy address' })); });
      expect(writeText).toHaveBeenCalledWith(ALICE);
      expect(within(d).getByRole('status')).toHaveTextContent('Copied');
      fireEvent.click(within(d).getByRole('button', { name: 'Disconnect' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(storage.get('account')).toBeNull();
      expect(wc.disconnect).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    }
  });

  it('a copy the browser refuses says so', async () => {
    storage.set('account', ALICE);
    const d = ui();
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Copy address' })); });
    expect(within(d).getByRole('status')).toHaveTextContent('Could not copy');
  });

  it('a pasted address shows as connected with source Address and no wallet name', () => {
    storage.set('account', ALICE);
    storage.set('account-source', 'address');
    const d = ui();
    expect(within(d).getByText('Unnamed Account')).toBeInTheDocument();
    const facts = d.querySelector('.wallet-facts') as HTMLElement;
    expect(within(facts).getAllByText('Address')).toHaveLength(2);
  });

  it('several accounts: the Switch Account list; picking one selects it and closes', async () => {
    ext.accounts.mockResolvedValue([{ address: ALICE, name: 'Alice', source: 'pezkuwi-js' }, { address: BOB, name: null, source: 'pezkuwi-js' }]);
    const d = ui();
    fireEvent.click(within(d).getByRole('button', { name: 'Connect Extension' }));
    expect(await within(d).findByText('Switch Account')).toBeInTheDocument();
    const list = d.querySelector('.wallet-list') as HTMLElement;
    expect(within(list).getAllByRole('button')).toHaveLength(2);
    expect(within(list).getByRole('button', { name: /Alice/ })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(within(list).getByRole('button', { name: /Unnamed Account/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.get('account')).toBe(BOB);
    expect(storage.get('account-source')).toBe('extension');
  });
});

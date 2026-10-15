import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import Home from './Home';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const full = vi.fn();
const balances = vi.hoisted(() => ({ load: (): Promise<unknown> => Promise.resolve([]), calls: 0 }));
// The home light reads only the relay; the full overview (three chains) must not gate it.
vi.mock('../data/network', () => ({ loadLiveness: () => Promise.resolve(true), loadNetwork: () => full() }));
const wc = vi.hoisted(() => ({ disconnect: vi.fn(() => Promise.resolve()) }));
vi.mock('../account/connectors/walletconnect', () => ({
  WC_DISCONNECTED: 'wc-off', WC_SESSION_KEY: 'wc-session', disconnectWalletConnect: wc.disconnect, restoreWalletConnect: () => Promise.resolve({ state: 'live', accounts: [] }),
}));
vi.mock('../data/balances', () => ({ loadBalances: () => { balances.calls++; return balances.load(); } }));

const renderHome = () => render(<MemoryRouter><AccountProvider><Home /></AccountProvider></MemoryRouter>);

describe('Home', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); storage.remove('account'); storage.remove('account-source'); balances.calls = 0; wc.disconnect.mockClear(); });

  it('shows the four tiles with links and the network light', async () => {
    renderHome();
    for (const [label, href] of [['Did my payment arrive?', '/payment'], ['Citizenship', '/citizenship'], ['Network', '/network'], ['Recent activity', '/account']]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(await screen.findByText('The network is working')).toBeInTheDocument();
    expect(full).not.toHaveBeenCalled();
  });

  it('with no account the card offers the three ways in, and reads no balance', async () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Open your account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open with my wallet' })).toHaveAttribute('href', '/account/open?way=wallet');
    expect(screen.getByRole('link', { name: 'Scan QR' })).toHaveAttribute('href', '/account/open?way=scan');
    expect(screen.getByRole('link', { name: 'Paste address' })).toHaveAttribute('href', '/account/open?way=paste');
    await screen.findByText('The network is working');
    expect(balances.calls).toBe(0);
  });

  it('with an account the card shows the HEZ total and opens the account', async () => {
    storage.set('account', ALICE);
    balances.load = () => Promise.resolve([{ symbol: 'HEZ', decimals: 12, amount: 4_999_900_000_000n }, { symbol: 'PEZ', decimals: 12, amount: 1n }]);
    renderHome();
    const hero = screen.getByRole('heading', { name: 'My account · Total' }).closest('section')!;
    expect(await within(hero).findByTitle('4.9999 HEZ')).toHaveTextContent('4.9999 HEZ');
    expect(within(hero).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/account');
    expect(within(hero).getByTitle(ALICE)).toHaveTextContent('5Grwva…GKutQY');
  });

  it('a failing balance read shows the error in the card, never a partial total', async () => {
    storage.set('account', ALICE);
    balances.load = () => Promise.reject(new Error('down'));
    renderHome();
    expect(await screen.findByText(/This could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/HEZ/)).toBeNull();
  });

  it('with an account the card shows Sign out next to the address; it clears the account', async () => {
    storage.set('account', ALICE);
    renderHome();
    const hero = screen.getByRole('heading', { name: 'My account · Total' }).closest('section')!;
    const out = within(hero).getByRole('button', { name: 'Sign out' });
    expect(out.closest('.hero-who')).toContainElement(within(hero).getByTitle(ALICE));
    fireEvent.click(out);
    expect(screen.getByRole('heading', { name: 'Open your account' })).toBeInTheDocument();
    expect(storage.get('account')).toBeNull();
    expect(wc.disconnect).not.toHaveBeenCalled();
  });

  it('signing out of a WalletConnect account ends the wallet session', async () => {
    storage.set('account', ALICE);
    storage.set('account-source', 'walletconnect');
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(storage.get('account')).toBeNull();
    expect(wc.disconnect).toHaveBeenCalledTimes(1);
  });

  it('the wallet ending the session (session_delete) signs out', async () => {
    storage.set('account', ALICE);
    storage.set('account-source', 'walletconnect');
    renderHome();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event('wc-off')); });
    expect(screen.getByRole('heading', { name: 'Open your account' })).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { WalletModalHost } from '../account/WalletModal';
import OpenAccount from './OpenAccount';

const ext = vi.hoisted(() => ({ accounts: vi.fn() }));
vi.mock('../account/connectors/extension', async (orig) => ({ ...(await orig<typeof import('../account/connectors/extension')>()), extensionAccounts: ext.accounts }));
vi.mock('../account/connectors/qr', () => ({ scanQr: () => Promise.reject(new DOMException('no', 'NotAllowedError')) }));

const ui = (entry = '/account/open') => render(
  <MemoryRouter initialEntries={[entry]}><AccountProvider><Routes>
    <Route path="/account/open" element={<OpenAccount />} />
    <Route path="/account" element={<p>ACCOUNT PAGE</p>} />
    <Route path="/citizenship" element={<p>CITIZENSHIP PAGE</p>} />
    <Route path="*" element={<p>ELSEWHERE</p>} />
  </Routes></AccountProvider></MemoryRouter>);
const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const pasteAlice = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Paste address' }));
  fireEvent.change(screen.getByPlaceholderText('Paste your address here'), { target: { value: ALICE } });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
};

describe('OpenAccount', () => {
  it('offers the wallet, scan and paste', async () => {
    await i18n.changeLanguage('en'); ui();
    const ways = [...document.querySelectorAll('.ways button')].map((b) => b.textContent);
    expect(ways).toEqual(['Open with my wallet', 'Scan QR', 'Paste address']);
  });
  it('shows a plain error for an invalid paste and opens a valid one', async () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Paste address' }));
    const box = screen.getByPlaceholderText('Paste your address here');
    fireEvent.change(box, { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This is not a valid address');
    fireEvent.change(box, { target: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('ACCOUNT PAGE')).toBeInTheDocument();
  });
  it('returns to an allowed next page', async () => {
    localStorage.clear(); ui('/account/open?next=/citizenship'); pasteAlice();
    expect(await screen.findByText('CITIZENSHIP PAGE')).toBeInTheDocument();
  });
  it('ignores a next that is not one of the app pages', async () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/account/open', '/elsewhere']) {
      localStorage.clear();
      const v = ui(`/account/open?next=${encodeURIComponent(bad)}`); pasteAlice();
      expect(await screen.findByText('ACCOUNT PAGE')).toBeInTheDocument();
      v.unmount();
    }
  });
});

describe('OpenAccount ways in', () => {
  // The app's wallet dialog is mounted beside the routes, as in App.tsx.
  const withDialog = (entry: string, strict = false) => {
    const tree = <MemoryRouter initialEntries={[entry]}><AccountProvider><Routes>
      <Route path="/account/open" element={<OpenAccount />} />
      <Route path="/account" element={<p>ACCOUNT PAGE</p>} />
      <Route path="/citizenship" element={<p>CITIZENSHIP PAGE</p>} />
    </Routes><WalletModalHost /></AccountProvider></MemoryRouter>;
    return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  };
  beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); ext.accounts.mockReset(); });

  it('the wallet way opens the wallet dialog', () => {
    withDialog('/account/open');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    expect(screen.getByRole('dialog', { name: 'Connect Wallet' })).toBeInTheDocument();
  });
  it('?way=wallet opens the wallet dialog once on arrival', async () => {
    withDialog('/account/open?way=wallet', true);
    expect(await screen.findAllByRole('dialog', { name: 'Connect Wallet' })).toHaveLength(1);
  });
  it('an account opened in the dialog goes on to the next page, the dialog still showing it', async () => {
    ext.accounts.mockResolvedValue([{ address: ALICE, name: 'Alice', source: 'pezkuwi-js' }]);
    withDialog('/account/open?next=/citizenship');
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect Extension' }));
    expect(await screen.findByText('CITIZENSHIP PAGE')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Wallet Connected' })).toBeInTheDocument();
    expect(localStorage.getItem('pezkuwi-explorer:account-source')).toBe('extension');
  });
  it('lets the user leave scan mode, and says so when the camera is denied', async () => {
    withDialog('/account/open');
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('camera could not be opened');
    for (const n of ['Open with my wallet', 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
  });
  it('opens straight into a way chosen on the home card', () => {
    for (const [way, check] of [
      ['paste', () => expect(screen.getByPlaceholderText('Paste your address here')).toBeInTheDocument()],
      ['bogus', () => expect(screen.getByRole('button', { name: 'Open with my wallet' })).toBeInTheDocument()],
    ] as const) {
      const v = withDialog(`/account/open?way=${way}`);
      check();
      v.unmount();
    }
  });
});

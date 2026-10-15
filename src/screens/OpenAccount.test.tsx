import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import OpenAccount from './OpenAccount';

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
  it('offers the three ways in', async () => {
    await i18n.changeLanguage('en'); ui();
    for (const n of ['Open with my wallet', 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
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

describe('OpenAccount connectors (mocked)', () => {
  const addr = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  const setup = async (wc: unknown, qr?: unknown) => {
    vi.resetModules();
    vi.doMock('../account/connectors/extension', () => {
      class NoWalletError extends Error {}
      class RejectedError extends Error {}
      return { NoWalletError, RejectedError, extensionAccounts: () => Promise.reject(new NoWalletError()) };
    });
    vi.doMock('../account/connectors/walletconnect', () => ({ walletConnectAccounts: wc }));
    vi.doMock('../account/connectors/qr', () => ({ scanQr: qr ?? (() => new Promise(() => {})) }));
    const { default: I18n } = await import('../i18n'); await I18n.changeLanguage('en');
    const { AccountProvider: P } = await import('../account/AccountContext');
    const { default: O } = await import('./OpenAccount');
    return () => render(<MemoryRouter initialEntries={['/account/open']}><P><Routes>
      <Route path="/account/open" element={<O />} /><Route path="/account" element={<p>ACCOUNT PAGE</p>} /></Routes></P></MemoryRouter>);
  };
  const reject = async () => (await import('../account/connectors/extension')).RejectedError;

  it('ignores a wallet approval that arrives after unmount', async () => {
    let resolve!: (a: string[]) => void;
    const r = await setup(() => new Promise<string[]>((res) => { resolve = res; }));
    const view = r();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    view.unmount();
    resolve([addr]); await new Promise((x) => setTimeout(x, 10));
    expect(screen.queryByText('ACCOUNT PAGE')).toBeNull();
    expect(localStorage.getItem('account')).toBeNull();
  });
  it('lets the user leave scan mode', async () => {
    const r = await setup(() => Promise.reject(new Error('x'))); r();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    for (const n of ['Open with my wallet', 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
  });
  it('shows "rejected" when WalletConnect is refused', async () => {
    let R!: new () => Error; const r = await setup(() => Promise.reject(new R())); R = await reject(); r();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('did not share');
  });
  it('shows "rejected" when WalletConnect returns no accounts', async () => {
    const r = await setup(() => Promise.resolve([])); r();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('did not share');
  });
  it('shows a camera message when the camera is denied', async () => {
    const r = await setup(() => Promise.reject(new Error('x')), () => Promise.reject(new DOMException('no', 'NotAllowedError'))); r();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('camera could not be opened');
  });
  it('under the wallet link, tells the user to paste or scan if the wallet does not open', async () => {
    const r = await setup((onUri: (u: string) => void) => { onUri('wc:abc@2?relay-protocol=irn&symKey=00'); return new Promise(() => {}); }); r();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    expect(await screen.findByRole('link', { name: 'Open with my wallet' })).toHaveAttribute('href', expect.stringMatching(/^wc:/));
    expect(screen.getByText('If your wallet does not open, go back and paste or scan your address instead.')).toBeInTheDocument();
  });
  it('does not render a non-wc link', async () => {
    const r = await setup((onUri: (u: string) => void) => { onUri('javascript:alert(1)'); return new Promise(() => {}); }); r();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument());
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });
});

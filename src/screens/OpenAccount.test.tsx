import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  it('on a desktop without the extension offers the QR for another device, scan and paste', async () => {
    await i18n.changeLanguage('en'); ui();
    for (const n of ['Wallet on another device (QR)', 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open with my wallet' })).toBeNull();
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
  const URI = 'wc:abc@2?relay-protocol=irn&symKey=00';
  const pairing = (uri = URI) => ({ uri, deepLink: 'pezkuwiwallet://wc?uri=' + encodeURIComponent(uri) });
  type Device = { routes: string[]; phone: boolean };
  const DESKTOP: Device = { routes: ['wc-qr'], phone: false };
  const DESKTOP_EXT: Device = { routes: ['extension', 'wc-qr'], phone: false };
  const PHONE: Device = { routes: ['wc-app'], phone: true };
  const followed: string[] = [];
  const setup = async (wc: unknown, opts: { qr?: unknown; device?: Device; ext?: () => Promise<string[]> } = {}) => {
    vi.resetModules();
    localStorage.clear();
    followed.length = 0;
    const device = opts.device ?? DESKTOP;
    vi.doMock('../account/connectors/extension', () => {
      class NoWalletError extends Error {}
      class RejectedError extends Error {}
      return { NoWalletError, RejectedError, extensionAccounts: opts.ext ?? (() => Promise.reject(new NoWalletError())) };
    });
    vi.doMock('../account/connectors/walletconnect', () => ({
      walletConnectAccounts: wc, WC_DISCONNECTED: 'wc-off',
      disconnectWalletConnect: () => Promise.resolve(), restoreWalletConnect: () => Promise.resolve({ state: 'live', accounts: [] }),
    }));
    vi.doMock('../account/connectors/qr', () => ({ scanQr: opts.qr ?? (() => new Promise(() => {})) }));
    vi.doMock('../account/platform', async (orig) => ({
      ...(await orig<typeof import('../account/platform')>()),
      routes: () => device.routes, onPhone: () => device.phone, followDeepLink: (h: string) => { followed.push(h); },
    }));
    const { default: I18n } = await import('../i18n'); await I18n.changeLanguage('en');
    const { AccountProvider: P } = await import('../account/AccountContext');
    const { default: O } = await import('./OpenAccount');
    return () => render(<MemoryRouter initialEntries={['/account/open']}><P><Routes>
      <Route path="/account/open" element={<O />} /><Route path="/account" element={<p>ACCOUNT PAGE</p>} /></Routes></P></MemoryRouter>);
  };
  const reject = async () => (await import('../account/connectors/extension')).RejectedError;
  const WC_BUTTON = 'Wallet on another device (QR)';

  it('ignores a wallet approval that arrives after unmount', async () => {
    let resolve!: (a: string[]) => void;
    const r = await setup(() => new Promise<string[]>((res) => { resolve = res; }));
    const view = r();
    fireEvent.click(screen.getByRole('button', { name: WC_BUTTON }));
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    view.unmount();
    resolve([addr]); await new Promise((x) => setTimeout(x, 10));
    expect(screen.queryByText('ACCOUNT PAGE')).toBeNull();
    expect(localStorage.getItem('pezkuwi-explorer:account')).toBeNull();
  });
  it('lets the user leave scan mode', async () => {
    const r = await setup(() => Promise.reject(new Error('x'))); r();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    // The header has its own Back (leave the screen); this is the one that leaves scan mode.
    const content = document.querySelector('.screen') as HTMLElement;
    fireEvent.click(await within(content).findByRole('button', { name: 'Back' }));
    for (const n of [WC_BUTTON, 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
  });
  it('shows "rejected" when WalletConnect is refused', async () => {
    let R!: new () => Error; const r = await setup(() => Promise.reject(new R())); R = await reject(); r();
    fireEvent.click(screen.getByRole('button', { name: WC_BUTTON }));
    expect(await screen.findByRole('alert')).toHaveTextContent('did not share');
  });
  it('shows "rejected" when WalletConnect returns no accounts', async () => {
    const r = await setup(() => Promise.resolve([])); r();
    fireEvent.click(screen.getByRole('button', { name: WC_BUTTON }));
    expect(await screen.findByRole('alert')).toHaveTextContent('did not share');
  });
  it('shows a camera message when the camera is denied', async () => {
    const r = await setup(() => Promise.reject(new Error('x')), { qr: () => Promise.reject(new DOMException('no', 'NotAllowedError')) }); r();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('camera could not be opened');
  });
  it('desktop: shows the pairing as a QR image with how-to and waiting notes, never the raw wc: text', async () => {
    const r = await setup((on: (p: unknown) => void) => { on(pairing()); return new Promise(() => {}); }); r();
    fireEvent.click(screen.getByRole('button', { name: WC_BUTTON }));
    const qr = await screen.findByRole('img', { name: 'WalletConnect QR' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d/);
    expect(screen.getByText('Pezkuwi Wallet → WalletConnect → scan the code')).toBeInTheDocument();
    expect(screen.getByText('Waiting for approval in the wallet…')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('wc:');
    expect(document.querySelector('a[href^="wc:"], a[href^="pezkuwiwallet:"]')).toBeNull();
    expect(followed).toEqual([]);
  });
  it('phone: follows the Pezkuwi Wallet deep link, shows it as a button, and offers the app on Play', async () => {
    const r = await setup((on: (p: unknown) => void) => { on(pairing()); return new Promise(() => {}); }, { device: PHONE }); r();
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    const link = await screen.findByRole('link', { name: 'Open Pezkuwi Wallet' });
    expect(link.getAttribute('href')).toMatch(/^pezkuwiwallet:\/\/wc\?uri=/);
    expect(link.getAttribute('href')).toBe(pairing().deepLink);
    expect(followed).toEqual([pairing().deepLink]);
    expect(screen.getByText('Waiting for approval in the wallet…')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Android app' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=io.pezkuwichain.wallet');
    expect(screen.queryByRole('img', { name: 'WalletConnect QR' })).toBeNull();
    expect(screen.queryByRole('button', { name: WC_BUTTON })).toBeNull();
  });
  it('a WalletConnect account is opened with source walletconnect', async () => {
    const r = await setup((on: (p: unknown) => void) => { on(pairing()); return Promise.resolve([addr]); }); r();
    fireEvent.click(screen.getByRole('button', { name: WC_BUTTON }));
    expect(await screen.findByText('ACCOUNT PAGE')).toBeInTheDocument();
    expect(localStorage.getItem('pezkuwi-explorer:account-source')).toBe('walletconnect');
  });
  it('desktop with the Pezkuwi extension: the extension first, the QR second; the extension opens with source extension', async () => {
    let wcCalls = 0;
    const r = await setup(() => { wcCalls++; return new Promise(() => {}); }, { device: DESKTOP_EXT, ext: () => Promise.resolve([addr]) }); r();
    const buttons = within(document.querySelector('.ways') as HTMLElement).getAllByRole('button').map((b) => b.textContent);
    expect(buttons.slice(0, 2)).toEqual(['Open with my wallet', WC_BUTTON]);
    fireEvent.click(screen.getByRole('button', { name: 'Open with my wallet' }));
    expect(await screen.findByText('ACCOUNT PAGE')).toBeInTheDocument();
    expect(localStorage.getItem('pezkuwi-explorer:account-source')).toBe('extension');
    expect(wcCalls).toBe(0);
  });
  it('opens straight into a way chosen on the home card', async () => {
    const r = await setup(() => new Promise(() => {}), { device: DESKTOP_EXT });
    const view = r();
    view.unmount();
    const { default: O } = await import('./OpenAccount');
    const { AccountProvider: P } = await import('../account/AccountContext');
    for (const [way, check] of [
      ['paste', () => expect(screen.getByPlaceholderText('Paste your address here')).toBeInTheDocument()],
      ['scan', () => expect(document.querySelector('video.scanner')).not.toBeNull()],
      ['bogus', () => expect(screen.getByRole('button', { name: 'Open with my wallet' })).toBeInTheDocument()],
    ] as const) {
      const v = render(<MemoryRouter initialEntries={[`/account/open?way=${way}`]}><P><Routes><Route path="/account/open" element={<O />} /></Routes></P></MemoryRouter>);
      check();
      v.unmount();
    }
  });
  it('?way=wallet starts the wallet flow once on arrival', async () => {
    let calls = 0;
    await setup(() => { calls++; return new Promise(() => {}); });
    const { default: O } = await import('./OpenAccount');
    const { AccountProvider: P } = await import('../account/AccountContext');
    const { StrictMode } = await import('react');
    render(<StrictMode><MemoryRouter initialEntries={['/account/open?way=wallet']}><P><Routes><Route path="/account/open" element={<O />} /></Routes></P></MemoryRouter></StrictMode>);
    await waitFor(() => expect(calls).toBe(1));
    await new Promise((x) => setTimeout(x, 20));
    expect(calls).toBe(1);
  });
  it('does not render or follow a non-wc pairing', async () => {
    for (const device of [DESKTOP, PHONE]) {
      const r = await setup((on: (p: unknown) => void) => { on(pairing('javascript:alert(1)')); return new Promise(() => {}); }, { device });
      const v = r();
      fireEvent.click(screen.getByRole('button', { name: device.phone ? 'Open with my wallet' : WC_BUTTON }));
      await waitFor(() => expect(within(document.querySelector('.screen') as HTMLElement).getByRole('button', { name: 'Back' })).toBeInTheDocument());
      expect(document.querySelector('a[href^="javascript"], a[href^="pezkuwiwallet"]')).toBeNull();
      expect(screen.queryByRole('img', { name: 'WalletConnect QR' })).toBeNull();
      expect(followed).toEqual([]);
      v.unmount();
    }
  });
});

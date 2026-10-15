import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as flush, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import type { Activity } from '../data/history';
import { WalletModalHost } from '../account/WalletModal';
import Account from './Account';
import ActivityDetail from './ActivityDetail';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

// react-router's memory history JSON-stringifies location state in a warning message; real browsers
// structured-clone it (BigInt is fine there), so teach JSON about BigInt for the test only.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) { return this.toString(); };

const impl = vi.hoisted(() => ({
  balances: (): Promise<unknown> => Promise.resolve([]),
  activity: (): Promise<unknown> => Promise.resolve([]),
  calls: [] as [string, unknown][],
}));
vi.mock('../data/balances', () => ({ loadBalances: (a: unknown) => { impl.calls.push(['balances', a]); return impl.balances(); } }));
vi.mock('../data/history', async (orig) => {
  const m = await orig<typeof import('../data/history')>();
  return { ...m, loadActivity: (a: unknown) => { impl.calls.push(['activity', a]); return impl.activity(); } };
});

const act = (over: Partial<Activity>): Activity => ({
  id: '1-0-from', when: Math.floor(Date.now() / 1000) - 7200, direction: 'sent', counterparty: BOB,
  symbol: 'HEZ', decimals: 12, amount: 1_000_000_000_000n, fee: 0n, ok: true, code: null, ...over,
});
const renderAccount = () =>
  render(<MemoryRouter><AccountProvider><Account /></AccountProvider></MemoryRouter>);

describe('Account', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    storage.set('account', ALICE);
    impl.calls = [];
    impl.balances = () => Promise.resolve([{ symbol: 'HEZ', decimals: 12, amount: 5_000_000_000_000n }]);
    impl.activity = async () => { const { NotIndexedError } = await import('../data/history'); throw new NotIndexedError(); };
  });

  it('shows balances and an honest "being prepared" history when not indexed', async () => {
    renderAccount();
    expect(await screen.findByTitle('5 HEZ')).toHaveTextContent('5 HEZ');
    expect(await screen.findByText('This section is being prepared.')).toBeInTheDocument();
  });

  it('breaks the HEZ total down by chain and lists each token', async () => {
    impl.balances = () => Promise.resolve([
      { symbol: 'HEZ', decimals: 12, amount: 5_000_000_000_000n, perChain: { relay: 2_000_000_000_000n, assetHub: 1_000_000_000_000n, people: 2_000_000_000_000n } },
      { symbol: 'PEZ', decimals: 12, amount: 1_250_000_000_000_000n },
      { symbol: 'USDT', decimals: 6, amount: 25_000_000n, standard: 'PEZ-20' },
    ]);
    renderAccount();
    await screen.findByTitle('5 HEZ');
    const chains = [...document.querySelectorAll('.chain-tile')].map((c) => c.textContent);
    expect(chains).toEqual(['Relay2', 'Asset Hub1', 'People2']);
    const tokens = within(screen.getByRole('region', { name: 'Tokens' })).getAllByRole('listitem').map((r) => r.textContent);
    // USDT carries the wallet's token-standard label after the network name, as in the Pezkuwi Wallet.
    expect(tokens).toEqual(['HEZPezkuwiChain5', 'PEZAsset Hub1,250', 'USDTAsset Hub (PEZ-20)25']);
  });

  it('marks with ≈ every figure that lost digits, and only those', async () => {
    impl.balances = () => Promise.resolve([
      { symbol: 'HEZ', decimals: 12, amount: 4_999_960_000_000n, perChain: { relay: 2_999_960_000_000n, assetHub: 1_000_000_000_000n, people: 1_000_000_000_000n } },
    ]);
    renderAccount();
    const total = await screen.findByTitle('4.99996 HEZ');
    expect(total).toHaveTextContent('≈4.9999 HEZ');
    expect([...document.querySelectorAll('.chain-amount')].map((c) => c.textContent)).toEqual(['≈2.9999', '1', '1']);
  });

  it('the header holds only back, title, theme and language; the address chip sits in the total card', async () => {
    renderAccount();
    await screen.findByTitle('5 HEZ');
    const chip = screen.getByRole('button', { name: '5Grwva…GKutQY' });
    expect(chip.closest('.total-card')).not.toBeNull();
    const header = screen.getByRole('banner');
    expect(within(header).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Back', 'Theme: Auto']);
    expect(within(header).getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
  });

  it('tapping the address chip opens the wallet dialog on this account (copy, Disconnect)', async () => {
    render(<MemoryRouter><AccountProvider><Account /><WalletModalHost /></AccountProvider></MemoryRouter>);
    await screen.findByTitle('5 HEZ');
    fireEvent.click(within(document.querySelector('.total-card') as HTMLElement).getByRole('button', { name: '5Grwva…GKutQY' }));
    const d = screen.getByRole('dialog', { name: 'Wallet Connected' });
    expect(within(d).getByTitle(ALICE)).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('puts activity under Today and Yesterday headers', async () => {
    const now = Math.floor(Date.now() / 1000);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0);
    impl.activity = () => Promise.resolve([act({ id: 'a', when: now }), act({ id: 'b', when: Math.floor(yesterday.getTime() / 1000), direction: 'received' })]);
    renderAccount();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getByText('You received')).toBeInTheDocument();
  });

  it('a failing balance source shows the error card, not a spinner', async () => {
    impl.balances = () => Promise.reject(new Error('down'));
    renderAccount();
    expect(await screen.findByText(/This could not be loaded/)).toBeInTheDocument();
  });

  it('an unknown-asset row shows its symbol and no amount', async () => {
    impl.activity = () => Promise.resolve([act({ symbol: '#777', decimals: null, amount: 123456789n })]);
    renderAccount();
    expect(await screen.findByText('#777')).toBeInTheDocument();
    expect(screen.queryByText(/123/)).toBeNull();
  });

  it('a known row renders the sent sentence with formatted amount', async () => {
    impl.activity = () => Promise.resolve([act({})]);
    renderAccount();
    expect(await screen.findByText('1 HEZ')).toBeInTheDocument();
    expect(screen.getByText(/You sent/)).toBeInTheDocument();
  });

  it('ckb timeline takes its relative time from the locale keys', async () => {
    await i18n.changeLanguage('ckb');
    impl.activity = () => Promise.resolve([act({})]);
    renderAccount();
    const el = await screen.findByText(/کاتژمێر/);
    expect(el.textContent).toContain('پێش ٢ کاتژمێر');
    expect(el.textContent).not.toMatch(/hours ago/);
    const time = /پێش\s\S+\sکاتژمێر/.exec(el.textContent ?? '')?.[0] ?? '';
    expect(time).toBe('پێش ٢ کاتژمێر');
    expect(time).not.toMatch(/[0-9]/);
  });

  it('with no open account it loads nothing and goes to the open screen', async () => {
    storage.remove('account');
    render(<MemoryRouter initialEntries={['/account']}><AccountProvider><Routes>
      <Route path="/account" element={<Account />} /><Route path="/account/open" element={<p>OPEN</p>} />
    </Routes></AccountProvider></MemoryRouter>);
    expect(await screen.findByText('OPEN')).toBeInTheDocument();
    await new Promise((x) => setTimeout(x, 10));
    expect(impl.calls).toEqual([]);
  });
  it('an empty history shows the sentence and no empty list', async () => {
    impl.activity = () => Promise.resolve([]);
    renderAccount();
    expect(await screen.findByText('No activity yet.')).toBeInTheDocument();
    expect(document.querySelector('ul.timeline')).toBeNull();
  });
  describe('relative time', () => {
    const T = 1_800_000_000;
    // Only Date and the interval are faked: testing-library keeps its real timeouts.
    beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(T * 1000); });
    afterEach(() => { vi.useRealTimers(); });

    it('is not frozen at mount: it moves on at least every minute while the screen is open', async () => {
      impl.activity = () => Promise.resolve([act({ when: T - 120 })]);
      renderAccount();
      expect(await screen.findByText(/2 minutes ago/)).toBeInTheDocument();
      vi.setSystemTime((T + 3600) * 1000);
      await flush(async () => { vi.advanceTimersByTime(60_000); });
      expect(screen.getByText(/1 hour ago/)).toBeInTheDocument();
      expect(screen.queryByText(/2 minutes ago/)).toBeNull();
    });
    it('is taken afresh when the history loads again', async () => {
      let fail = true;
      impl.activity = () => (fail ? Promise.reject(new Error('down')) : Promise.resolve([act({ when: T + 3600 - 120 })]));
      renderAccount();
      const retry = await screen.findByRole('button', { name: 'Try again' });
      fail = false;
      vi.setSystemTime((T + 3600) * 1000);
      fireEvent.click(retry);
      expect(await screen.findByText(/2 minutes ago/)).toBeInTheDocument();
    });
  });
  it('a failed row shows Failed and not the sent sentence', async () => {
    impl.activity = () => Promise.resolve([act({ ok: false })]);
    renderAccount();
    expect(await screen.findByText(/Failed/)).toBeInTheDocument();
    expect(screen.queryByText(/You sent/)).toBeNull();
  });

  it('has a clear Sign out button; it clears the account and goes home', async () => {
    render(<MemoryRouter initialEntries={['/account']}><AccountProvider><Routes>
      <Route path="/account" element={<Account />} /><Route path="/" element={<p>HOME</p>} /><Route path="/account/open" element={<p>OPEN</p>} />
    </Routes></AccountProvider></MemoryRouter>);
    await screen.findByTitle('5 HEZ');
    const out = screen.getByRole('button', { name: 'Sign out' });
    expect(out).toHaveClass('btn', 'btn-quiet');
    fireEvent.click(out);
    expect(await screen.findByText('HOME')).toBeInTheDocument();
    expect(storage.get('account')).toBeNull();
  });
});

describe('ActivityDetail', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); storage.set('account', ALICE); });
  const detail = (state: unknown, path = '/account/activity/1-0-from') =>
    render(
      <MemoryRouter initialEntries={[{ pathname: path, state }]}><AccountProvider>
        <Routes>
          <Route path="account" element={<p>ACCT</p>} />
          <Route path="account/open" element={<p>OPEN</p>} />
          <Route path="account/activity/:id" element={<ActivityDetail />} />
        </Routes>
      </AccountProvider></MemoryRouter>);

  it('no state redirects to /account', async () => {
    detail(null);
    expect(await screen.findByText('ACCT')).toBeInTheDocument();
  });
  it('valid state renders amount and counterparty', async () => {
    detail(act({}));
    expect(await screen.findByText('1 HEZ')).toBeInTheDocument();
    expect(screen.getByText('To').nextElementSibling?.querySelector(`bdi[title="${BOB}"]`)).not.toBeNull();
  });
  it('unknown asset renders the symbol with no amount', async () => {
    detail(act({ symbol: '#777', decimals: null, amount: 123456789n }));
    expect(await screen.findByText('#777')).toBeInTheDocument();
    expect(screen.queryByText(/123/)).toBeNull();
  });
  it('a failed transaction heading says Failed', async () => {
    detail(act({ ok: false }));
    expect(await screen.findByRole('heading', { name: /Failed/ })).toBeInTheDocument();
  });
  it('writes the date with the same language tag as the day headers', async () => {
    await i18n.changeLanguage('kmr');
    const spy = vi.spyOn(Date.prototype, 'toLocaleString');
    try {
      detail(act({}));
      await screen.findByText('Qediya');
      expect(spy.mock.calls.map((c) => c[0])).toContain('ku');
      expect(spy.mock.calls.map((c) => c[0])).not.toContain('kmr');
    } finally { spy.mockRestore(); await i18n.changeLanguage('en'); }
  });
  it('shows a well-formed transaction code', async () => {
    const code = '0x' + 'ab'.repeat(32);
    detail(act({ code }));
    expect(await screen.findByText(code)).toBeInTheDocument();
  });
  it('a malformed transaction code is treated as no code: the rest still shows, the code does not', async () => {
    detail(act({ code: '<b>zzz</b>' }));
    expect(await screen.findByText('1 HEZ')).toBeInTheDocument();
    expect(screen.queryByText(/zzz/)).toBeNull();
    expect(screen.queryByText(/Transaction code/)).toBeNull();
  });
  it('mismatched id redirects', async () => {
    detail(act({ id: 'other' }));
    expect(await screen.findByText('ACCT')).toBeInTheDocument();
  });
  it('malformed state (string amount) redirects', async () => {
    detail({ ...act({}), amount: '5' });
    expect(await screen.findByText('ACCT')).toBeInTheDocument();
  });
  it('no open account redirects to open', async () => {
    storage.remove('account');
    detail(act({}));
    expect(await screen.findByText('OPEN')).toBeInTheDocument();
  });
});

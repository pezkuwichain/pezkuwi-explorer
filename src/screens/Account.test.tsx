import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import type { Activity } from '../data/history';
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
    expect(await screen.findByText('5 HEZ')).toBeInTheDocument();
    expect(await screen.findByText('This section is being prepared.')).toBeInTheDocument();
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
  it('a failed row shows Failed and not the sent sentence', async () => {
    impl.activity = () => Promise.resolve([act({ ok: false })]);
    renderAccount();
    expect(await screen.findByText(/Failed/)).toBeInTheDocument();
    expect(screen.queryByText(/You sent/)).toBeNull();
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
    expect(screen.getByText(/To:/)).toBeInTheDocument();
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

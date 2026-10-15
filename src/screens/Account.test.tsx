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

const impl = vi.hoisted(() => ({
  balances: (): Promise<unknown> => Promise.resolve([]),
  activity: (): Promise<unknown> => Promise.resolve([]),
}));
vi.mock('../data/balances', () => ({ loadBalances: () => impl.balances() }));
vi.mock('../data/history', async (orig) => {
  const m = await orig<typeof import('../data/history')>();
  return { ...m, loadActivity: () => impl.activity() };
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
    expect(await screen.findByText(/پێش 2 کاتژمێر/)).toBeInTheDocument();
    expect(screen.queryByText(/hours ago/)).toBeNull();
  });

  it('detail without router state redirects to /account', async () => {
    render(
      <MemoryRouter initialEntries={['/account/activity/x']}><AccountProvider>
        <Routes><Route path="account" element={<p>ACCT</p>} /><Route path="account/activity/:id" element={<ActivityDetail />} /></Routes>
      </AccountProvider></MemoryRouter>);
    expect(await screen.findByText('ACCT')).toBeInTheDocument();
  });
});

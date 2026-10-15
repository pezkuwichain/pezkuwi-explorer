import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { NETWORK, ZAGROS_HISTORY_URL } from '../config/network';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import Account from './Account';
import PaymentStatus from './PaymentStatus';

// End to end with history switched on exactly as the owner will switch it on: the real data layer
// against a stubbed indexer at ZAGROS_HISTORY_URL. Only the chain balances are mocked.
vi.mock('../data/balances', () => ({ loadBalances: () => Promise.resolve([]) }));

const ME = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const CODE = '0x' + 'cd'.repeat(32);
const ts = () => String(Math.floor(Date.now() / 1000) - 7200);
const xfer = (id: string, address: string, from: string, to: string, amount: string) => ({
  id, extrinsicHash: CODE, timestamp: ts(), address, assetTransfer: null, extrinsic: null,
  transfer: { from, to, amount, fee: '1', success: true },
});
// A batch of two transfers ME -> BOB, each indexed once per side.
const nodes = () => [
  xfer('7-2-from', ME, ME, BOB, '1000000000000'), xfer('7-2-to', BOB, ME, BOB, '1000000000000'),
  xfer('7-3-from', ME, ME, BOB, '2000000000000'), xfer('7-3-to', BOB, ME, BOB, '2000000000000'),
];
const calls: { url: string; method?: string; query: string }[] = [];
function indexer(url: string, init: RequestInit) {
  const query = JSON.parse(String(init.body)).query as string;
  calls.push({ url, method: init.method, query });
  const m = /address:\{equalTo:"([^"]+)"\}/.exec(query);
  const data = m ? nodes().filter((n) => n.address === m[1]) : query.includes('extrinsicHash') ? nodes() : [];
  return Promise.resolve({ ok: true, json: async () => ({ data: { historyElements: { nodes: data } } }) });
}

const shipped = NETWORK.history.assetHub;
beforeEach(async () => {
  await i18n.changeLanguage('en');
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(indexer));
  NETWORK.history.assetHub = ZAGROS_HISTORY_URL;
});
afterEach(() => { NETWORK.history.assetHub = shipped; vi.unstubAllGlobals(); });

describe('history switched on (ZAGROS_HISTORY_URL)', () => {
  it('the account screen lists the activity from the indexer', async () => {
    storage.set('account', ME);
    render(<MemoryRouter><AccountProvider><Account /></AccountProvider></MemoryRouter>);
    expect(await screen.findByText('1 HEZ')).toBeInTheDocument();
    expect(screen.getByText('2 HEZ')).toBeInTheDocument();
    expect(document.querySelectorAll('ul.timeline li')).toHaveLength(2);
    expect(calls[0]).toMatchObject({ url: ZAGROS_HISTORY_URL, method: 'POST' });
  });

  const ask = (value: string) => {
    render(<MemoryRouter><PaymentStatus /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('Paste the transaction code or an address'), { target: { value } });
    fireEvent.submit(screen.getByRole('search'));
  };
  it('a code gets the verdict with every transfer of the batch', async () => {
    ask(CODE);
    expect(await screen.findByRole('heading', { name: 'Arrived' })).toBeInTheDocument();
    const rows = within(screen.getByRole('status')).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('1 HEZ to'), expect.stringContaining('2 HEZ to')]);
  });
  it('an address gets a list, not a verdict', async () => {
    ask(BOB);
    const answer = await screen.findByRole('status');
    const rows = await within(answer).findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Received 1 HEZ from/);
    expect(within(answer).queryByRole('heading')).toBeNull();
  });
});

// The gates above are only worth something if they run: nothing in the suite may be skipped, focused or left as todo.
describe('suite integrity', () => {
  it('no test file skips, focuses or defers a test', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.test\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk('src');
    expect(files.length).toBeGreaterThan(10);
    const banned = new RegExp(String.raw`\b(it|test|describe)\.(skip|only|todo|skipIf|runIf)\b|\bx(it|describe)\(`);
    for (const f of files) expect(`${f}: ${readFileSync(f, 'utf8')}`).not.toMatch(banned);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { InvalidLookupError, NotIndexedError, type Activity } from '../data/history';
import { NETWORK } from '../config/network';

const find = vi.fn(); const lag = vi.fn(); const scan = vi.fn();
vi.mock('../data/history', async (o) => ({ ...(await o<typeof import('../data/history')>()), findPayment: (q: string) => find(q), indexerLag: () => lag() }));
vi.mock('../account/connectors/qr', () => ({ scanQr: (...a: unknown[]) => scan(...a) }));
const CODE = '0x' + 'ab'.repeat(32);
const ME = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const THEM = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const HOUR_AGO = () => Math.floor(Date.now() / 1000) - 7200;
const tr = (over: Partial<Activity>): Activity => ({
  id: '9-1-from', when: HOUR_AGO(), direction: 'sent', counterparty: THEM,
  symbol: 'HEZ', decimals: 12, amount: 1_000_000_000_000n, fee: 0n, ok: true, code: CODE, call: null, ...over,
});
// The screen's content under its header (the header has its own Back button).
const content = () => document.querySelector('.screen') as HTMLElement;
const code = (status: string, transfers: Activity[]) => ({ kind: 'code', status, transfers });
const arrived = () => code('arrived', [tr({})]);

async function mount() {
  await i18n.changeLanguage('en');
  const { default: P } = await import('./PaymentStatus');
  render(<MemoryRouter><P /></MemoryRouter>);
}
async function ask(value = CODE) {
  await mount();
  fireEvent.change(screen.getByPlaceholderText('Paste the transaction code or an address'), { target: { value } });
  fireEvent.submit(screen.getByRole('search'));
}

// The lookup form exists only once an indexer is configured; the screens below assume one.
const shipped = NETWORK.history.assetHub;
beforeEach(() => { find.mockReset(); lag.mockReset(); scan.mockReset(); NETWORK.history.assetHub = 'https://history.example/graphql'; });
afterEach(() => { NETWORK.history.assetHub = shipped; });

describe('PaymentStatus', () => {
  it('with no indexer configured shows the preparing message at once and no input, scan or submit', async () => {
    NETWORK.history.assetHub = null;
    await mount();
    expect(screen.getByText('This section is being prepared.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Paste the transaction code or an address')).toBeNull();
    expect(screen.queryByRole('search')).toBeNull();
    expect(within(content()).queryByRole('button')).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });
  it('arrived', async () => { find.mockResolvedValue(arrived()); await ask(); expect(await screen.findByText('Arrived')).toBeInTheDocument(); });
  it('a failed transfer is explained neutrally: the asker need not be the sender', async () => {
    find.mockResolvedValue(code('failed', [tr({ ok: false })])); await ask();
    expect(await screen.findByText("It did not go through. The money did not leave the sender's account; only the fee was taken.")).toBeInTheDocument();
    expect(screen.queryByText(/Your money/)).toBeNull();
  });
  it('a failed code that made no transfer has its own message', async () => {
    find.mockResolvedValue(code('failedNotAPayment', [])); await ask();
    expect(await screen.findByText('This code is not a payment, and it did not go through.')).toBeInTheDocument();
    expect(within(screen.getByRole('status')).queryByRole('heading')).toBeNull();
  });
  it('not found while the indexer lags means on its way', async () => { find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(50); await ask(); expect(await screen.findByText('On its way')).toBeInTheDocument(); });
  it('not found with a current indexer says so plainly', async () => { find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(0); await ask(); expect(await screen.findByText(/We could not find this payment yet/)).toBeInTheDocument(); });
  it('not found with an unreadable lag says so plainly, not "on its way"', async () => {
    find.mockResolvedValue({ status: 'notFound' }); lag.mockRejectedValue(new Error('history 500')); await ask();
    expect(await screen.findByText(/We could not find this payment yet/)).toBeInTheDocument();
    expect(screen.queryByText('On its way')).toBeNull();
  });
  it('a code lookup gives the verdict with the amount, the time and the recipient', async () => {
    find.mockResolvedValue(arrived()); await ask();
    expect(await screen.findByRole('heading', { name: 'Arrived' })).toBeInTheDocument();
    expect(screen.getByText(/The money reached/)).toBeInTheDocument();
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('1 HEZ');
    expect(row).toHaveTextContent('2 hours ago');
    expect(row.querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
  });
  it('a failed code shows what did not go, to whom and when, without a "to" sentence', async () => {
    find.mockResolvedValue(code('failed', [tr({ ok: false })])); await ask();
    expect(await screen.findByRole('heading', { name: 'Did not arrive' })).toBeInTheDocument();
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('1 HEZ');
    expect(row).toHaveTextContent('Failed');
    expect(row).not.toHaveTextContent('1 HEZ to');
    expect(row).toHaveTextContent('2 hours ago');
    expect(row.querySelector('.status-failed')).toHaveTextContent('Failed');
    expect(row.querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
  });
  // No "went through" heading may sit above a failed row.
  const noFailedUnderWentThrough = () => {
    for (const h of screen.queryAllByRole('heading', { name: 'These payments went through' })) {
      const list = h.parentElement!.querySelector('h2 + p + ul, h2 + ul');
      expect(list).not.toBeNull();
      for (const li of list!.querySelectorAll('li')) {
        expect(within(li as HTMLElement).queryByRole('img', { name: 'Failed' })).toBeNull();
        expect(li).not.toHaveTextContent('Failed');
      }
    }
  };
  it('a code covering several transfers lists every one, with no single "Arrived"', async () => {
    find.mockResolvedValue(code('several', [tr({ id: '9-1-from' }), tr({ id: '9-2-from', amount: 2_000_000_000_000n, counterparty: ME })])); await ask();
    expect(await screen.findByRole('heading', { name: 'These payments went through' })).toBeInTheDocument();
    expect(screen.queryByText('Arrived')).toBeNull();
    expect(document.querySelector('.big-mark')).toBeNull();
    expect(screen.getByText('If your address is not in this list, this code did not pay you.')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('1 HEZ to');
    expect(within(rows[0]).getByRole('img', { name: 'Done' })).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('2 HEZ to');
    expect(rows[1].querySelector(`bdi[title="${ME}"]`)).not.toBeNull();
    expect(screen.queryByText('These did not go through')).toBeNull();
    noFailedUnderWentThrough();
  });
  it('a mixed batch shows the ones that went through and, separately, the ones that did not', async () => {
    find.mockResolvedValue(code('several', [tr({ id: '9-1-from' }), tr({ id: '9-2-from', ok: false }), tr({ id: '9-3-from', amount: 3_000_000_000_000n })])); await ask();
    const ok = await screen.findByRole('heading', { name: 'These payments went through' });
    const bad = screen.getByText('These did not go through');
    const okRows = [...ok.parentElement!.querySelectorAll('ul')[0].querySelectorAll('li')];
    expect(okRows.map((r) => r.textContent)).toEqual([expect.stringContaining('1 HEZ to'), expect.stringContaining('3 HEZ to')]);
    const badList = bad.nextElementSibling!;
    expect(badList.tagName).toBe('UL');
    const badRows = [...badList.querySelectorAll('li')];
    expect(badRows).toHaveLength(1);
    expect(badRows[0]).toHaveTextContent('Failed');
    expect(within(badRows[0]).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
    expect(badRows[0]).not.toHaveTextContent('1 HEZ to');
    expect(badRows[0].querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
    noFailedUnderWentThrough();
  });
  it('a code whose page was full shows the list, says it cannot tell, and gives no verdict', async () => {
    find.mockResolvedValue(code('incomplete', [tr({ id: '9-1-from' }), tr({ id: '9-2-from', ok: false })])); await ask();
    expect(await screen.findByText('This code may have more transfers than shown here. If your address is not in this list, we cannot tell from here whether this code paid you.')).toBeInTheDocument();
    expect(screen.queryByText(/did not pay you/)).toBeNull();
    expect(within(screen.getByRole('status')).queryByRole('heading')).toBeNull();
    expect(document.querySelector('.big-mark')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
  it('a full page with no transfer rows shows only that sentence, no empty list', async () => {
    find.mockResolvedValue(code('incomplete', [])); await ask();
    expect(await screen.findByText(/we cannot tell from here whether this code paid you/)).toBeInTheDocument();
    expect(screen.queryByText(/did not pay you/)).toBeNull();
    expect(within(screen.getByRole('status')).queryByRole('list')).toBeNull();
    expect(document.querySelector('.answer ul')).toBeNull();
  });
  it('an address lookup lists recent transfers relative to that address, with no verdict', async () => {
    find.mockResolvedValue({ kind: 'address', status: 'recent', address: ME, transfers: [
      tr({ id: 'a', direction: 'received', counterparty: THEM }),
      tr({ id: 'b', direction: 'sent', counterparty: THEM, symbol: '#777', decimals: null, amount: 123456789n, ok: false }),
      tr({ id: 'c', direction: 'received', counterparty: THEM, ok: false }),
    ] });
    await ask(ME);
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    // A stranger's payment to this address must not read as "your payment arrived".
    expect(within(screen.getByRole('status')).queryByRole('heading')).toBeNull();
    expect(screen.queryByText('Arrived')).toBeNull();
    expect(screen.queryByText(/The money reached/)).toBeNull();
    expect(document.querySelector('.big-mark')).toBeNull();
    expect(screen.getByText(/Latest payments of/).querySelector(`bdi[title="${ME}"]`)).not.toBeNull();
    expect(rows[0]).toHaveTextContent(/Received 1 HEZ from/);
    expect(rows[0]).toHaveTextContent('2 hours ago');
    expect(within(rows[0]).getByRole('img', { name: 'Done' })).toBeInTheDocument();
    expect(rows[0].querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
    // A failed row uses no sent/received verb: amount, Failed, counterparty, time, marked Failed.
    expect(rows[1]).not.toHaveTextContent(/Sent|Received/);
    expect(rows[1]).toHaveTextContent('#777');
    expect(rows[1]).toHaveTextContent('Failed');
    expect(rows[1]).toHaveTextContent('2 hours ago');
    expect(rows[1].querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
    expect(rows[1]).not.toHaveTextContent('123');
    expect(within(rows[1]).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
    expect(rows[2]).not.toHaveTextContent(/Sent|Received/);
    expect(rows[2]).toHaveTextContent('Failed');
    expect(rows[2]).toHaveTextContent('From 5FHneW…M694ty');
  });
  it('an address lookup shows at most five transfers', async () => {
    const many = Array.from({ length: 8 }, (_, i) => tr({ id: `r${i}`, direction: 'received' }));
    find.mockResolvedValue({ kind: 'address', status: 'recent', address: ME, transfers: many }); await ask(ME);
    expect(await screen.findAllByRole('listitem')).toHaveLength(5);
  });
  it('a code that is not a payment says so', async () => { find.mockResolvedValue(code('notAPayment', [])); await ask(); expect(await screen.findByText('This code is not a payment.')).toBeInTheDocument(); });
  it('no indexer shows the preparing message', async () => { find.mockRejectedValue(new NotIndexedError()); await ask(); expect(await screen.findByText('This section is being prepared.')).toBeInTheDocument(); });
  it('invalid input shows the invalid message', async () => { find.mockRejectedValue(new InvalidLookupError()); await ask('nonsense'); expect(await screen.findByRole('alert')).toHaveTextContent('not a valid address'); });
  it('a plain error that happens to carry the old message is a generic error, not "invalid"', async () => {
    find.mockRejectedValue(new Error('not a code or address')); await ask('nonsense');
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });
  it('any other failure shows the generic error', async () => { find.mockRejectedValue(new Error('boom')); await ask(); expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument(); });
  it('a scanned code fills the box and submits', async () => {
    scan.mockResolvedValue(CODE); find.mockResolvedValue(code('failed', [tr({ ok: false })]));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    expect(await screen.findByText(/It did not go through/)).toBeInTheDocument();
    expect(find).toHaveBeenCalledWith(CODE);
    expect(screen.getByPlaceholderText('Paste the transaction code or an address')).toHaveValue(CODE);
  });
  it('a denied camera shows the camera message and Back leaves scan mode', async () => {
    scan.mockRejectedValue(new DOMException('no', 'NotAllowedError')); await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('camera could not be opened');
  });
  it('Back stops an open scan', async () => {
    scan.mockReturnValue(new Promise(() => {})); await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    await waitFor(() => expect(scan).toHaveBeenCalled());
    const signal = scan.mock.calls[0][1] as AbortSignal;
    fireEvent.click(within(content()).getByRole('button', { name: 'Back' }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Scan QR' })).toBeInTheDocument();
  });
  it('offers the account button only under an answer about a payment', async () => {
    const cases: [unknown, boolean][] = [
      [arrived(), true], [code('failed', [tr({ ok: false })]), true], [code('several', [tr({ id: 'a' }), tr({ id: 'b' })]), true],
      [code('incomplete', [tr({})]), true], [code('notAPayment', []), false],
    ];
    for (const [answer, shown] of cases) {
      find.mockResolvedValue(answer); await ask();
      await screen.findByRole('status');
      await waitFor(() => expect(screen.queryByText(/Loading/)).toBeNull());
      expect(!!screen.queryByRole('link', { name: 'My account' })).toBe(shown);
      document.body.innerHTML = '';
    }
    for (const fail of [new InvalidLookupError(), new NotIndexedError(), new Error('x')]) {
      find.mockRejectedValue(fail); await ask();
      await screen.findByRole('status');
      expect(screen.queryByRole('link', { name: 'My account' })).toBeNull();
      document.body.innerHTML = '';
    }
    find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(0); await ask();
    await screen.findByText(/We could not find this payment yet/);
    expect(screen.queryByRole('link', { name: 'My account' })).toBeNull();
  });
  it('the field shows a whole code on two wrapping lines, and Enter looks it up', async () => {
    find.mockResolvedValue(arrived()); await mount();
    const field = screen.getByPlaceholderText('Paste the transaction code or an address');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '2');
    fireEvent.change(field, { target: { value: CODE } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
  });
  it('clears the answer as soon as the input changes', async () => {
    find.mockResolvedValue(arrived()); await ask();
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Paste the transaction code or an address'), { target: { value: '0x' } });
    expect(screen.queryByText('Arrived')).toBeNull();
  });
  it('entering scan mode supersedes an in-flight lookup', async () => {
    let done!: (v: unknown) => void;
    find.mockReturnValue(new Promise((r) => { done = r; })); scan.mockReturnValue(new Promise(() => {}));
    await ask();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    done(arrived());
    await new Promise((x) => setTimeout(x, 20));
    expect(screen.queryByText('Arrived')).toBeNull();
    expect(within(content()).getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

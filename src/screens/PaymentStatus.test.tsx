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
  symbol: 'HEZ', decimals: 12, amount: 1_000_000_000_000n, fee: 0n, ok: true, code: CODE, ...over,
});
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
    expect(screen.queryByRole('button')).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });
  it('arrived', async () => { find.mockResolvedValue(arrived()); await ask(); expect(await screen.findByText('Arrived')).toBeInTheDocument(); });
  it('failed explains the money stayed', async () => { find.mockResolvedValue(code('failed', [])); await ask(); expect(await screen.findByText(/Your money is still in your account/)).toBeInTheDocument(); });
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
  it('a failed code shows what did not go, to whom and when', async () => {
    find.mockResolvedValue(code('failed', [tr({ ok: false })])); await ask();
    expect(await screen.findByRole('heading', { name: 'Did not arrive' })).toBeInTheDocument();
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('1 HEZ');
    expect(row).toHaveTextContent('2 hours ago');
    expect(row.querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
  });
  it('a code covering several transfers lists every one of them', async () => {
    find.mockResolvedValue(code('arrived', [tr({ id: '9-1-from' }), tr({ id: '9-2-from', amount: 2_000_000_000_000n, counterparty: ME })])); await ask();
    expect(await screen.findByRole('heading', { name: 'Arrived' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('1 HEZ');
    expect(rows[1]).toHaveTextContent('2 HEZ');
    expect(rows[1].querySelector(`bdi[title="${ME}"]`)).not.toBeNull();
  });
  it('a batch that only partly went through says so and marks each transfer', async () => {
    find.mockResolvedValue(code('partial', [tr({ id: '9-1-from' }), tr({ id: '9-2-from', ok: false })])); await ask();
    expect(await screen.findByRole('heading', { name: 'Only part of it arrived' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('✅');
    expect(rows[1]).toHaveTextContent('❌');
  });
  it('an address lookup lists recent transfers relative to that address, with no verdict', async () => {
    find.mockResolvedValue({ kind: 'address', status: 'recent', address: ME, transfers: [
      tr({ id: 'a', direction: 'received', counterparty: THEM }),
      tr({ id: 'b', direction: 'sent', counterparty: THEM, symbol: '#777', decimals: null, amount: 123456789n, ok: false }),
    ] });
    await ask(ME);
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // A stranger's payment to this address must not read as "your payment arrived".
    expect(within(screen.getByRole('status')).queryByRole('heading')).toBeNull();
    expect(screen.queryByText('Arrived')).toBeNull();
    expect(screen.queryByText(/The money reached/)).toBeNull();
    expect(document.querySelector('.big-mark')).toBeNull();
    expect(screen.getByText(/Latest payments of/).querySelector(`bdi[title="${ME}"]`)).not.toBeNull();
    expect(rows[0]).toHaveTextContent(/Received 1 HEZ from/);
    expect(rows[0]).toHaveTextContent('2 hours ago');
    expect(rows[0]).toHaveTextContent('✅');
    expect(rows[0].querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
    expect(rows[1]).toHaveTextContent(/Sent #777 to/);
    expect(rows[1]).not.toHaveTextContent('123');
    expect(rows[1]).toHaveTextContent('❌');
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
    scan.mockResolvedValue(CODE); find.mockResolvedValue(code('failed', []));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    expect(await screen.findByText(/Your money is still in your account/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Scan QR' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { InvalidLookupError, NotIndexedError } from '../data/history';
import { NETWORK } from '../config/network';

const find = vi.fn(); const lag = vi.fn(); const scan = vi.fn();
vi.mock('../data/history', async (o) => ({ ...(await o<typeof import('../data/history')>()), findPayment: (q: string) => find(q), indexerLag: () => lag() }));
vi.mock('../account/connectors/qr', () => ({ scanQr: (...a: unknown[]) => scan(...a) }));
const CODE = '0x' + 'ab'.repeat(32);
const ME = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const THEM = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

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
beforeEach(() => { find.mockReset(); lag.mockReset(); scan.mockReset(); NETWORK.history.assetHub = 'https://history.example/graphql'; });
afterEach(() => { NETWORK.history.assetHub = null; });

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
  it('arrived', async () => { find.mockResolvedValue({ status: 'arrived', activity: { counterparty: null } }); await ask(); expect(await screen.findByText('Arrived')).toBeInTheDocument(); });
  it('failed explains the money stayed', async () => { find.mockResolvedValue({ status: 'failed' }); await ask(); expect(await screen.findByText(/Your money is still in your account/)).toBeInTheDocument(); });
  it('not found while the indexer lags means on its way', async () => { find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(50); await ask(); expect(await screen.findByText('On its way')).toBeInTheDocument(); });
  it('not found with a current indexer says so plainly', async () => { find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(0); await ask(); expect(await screen.findByText(/We could not find this payment yet/)).toBeInTheDocument(); });
  it('not found with an unreadable lag says so plainly, not "on its way"', async () => {
    find.mockResolvedValue({ status: 'notFound' }); lag.mockRejectedValue(new Error('history 500')); await ask();
    expect(await screen.findByText(/We could not find this payment yet/)).toBeInTheDocument();
    expect(screen.queryByText('On its way')).toBeNull();
  });
  it('a code lookup says the money reached the recipient', async () => {
    find.mockResolvedValue({ status: 'arrived', activity: { direction: 'sent', counterparty: THEM } }); await ask();
    expect(await screen.findByText(/The money reached/)).toBeInTheDocument();
    expect(document.querySelector(`bdi[title="${THEM}"]`)).not.toBeNull();
  });
  it('an address lookup of a received payment names the queried address, not the sender', async () => {
    find.mockResolvedValue({ status: 'arrived', activity: { direction: 'received', counterparty: THEM } }); await ask(ME);
    expect(await screen.findByText(/The money reached/)).toBeInTheDocument();
    expect(document.querySelector(`bdi[title="${ME}"]`)).not.toBeNull();
    expect(document.querySelector(`bdi[title="${THEM}"]`)).toBeNull();
  });
  it('a code that is not a payment says so', async () => { find.mockResolvedValue({ status: 'notAPayment' }); await ask(); expect(await screen.findByText('This code is not a payment.')).toBeInTheDocument(); });
  it('no indexer shows the preparing message', async () => { find.mockRejectedValue(new NotIndexedError()); await ask(); expect(await screen.findByText('This section is being prepared.')).toBeInTheDocument(); });
  it('invalid input shows the invalid message', async () => { find.mockRejectedValue(new InvalidLookupError()); await ask('nonsense'); expect(await screen.findByRole('alert')).toHaveTextContent('not a valid address'); });
  it('a plain error that happens to carry the old message is a generic error, not "invalid"', async () => {
    find.mockRejectedValue(new Error('not a code or address')); await ask('nonsense');
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });
  it('any other failure shows the generic error', async () => { find.mockRejectedValue(new Error('boom')); await ask(); expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument(); });
  it('a scanned code fills the box and submits', async () => {
    scan.mockResolvedValue(CODE); find.mockResolvedValue({ status: 'failed' });
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
    find.mockResolvedValue({ status: 'arrived', activity: { counterparty: null } }); await ask();
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Paste the transaction code or an address'), { target: { value: '0x' } });
    expect(screen.queryByText('Arrived')).toBeNull();
  });
  it('entering scan mode supersedes an in-flight lookup', async () => {
    let done!: (v: unknown) => void;
    find.mockReturnValue(new Promise((r) => { done = r; })); scan.mockReturnValue(new Promise(() => {}));
    await ask();
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));
    done({ status: 'arrived', activity: { counterparty: null } });
    await new Promise((x) => setTimeout(x, 20));
    expect(screen.queryByText('Arrived')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

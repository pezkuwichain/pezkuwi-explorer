import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import Network from './Network';

type Overview = { live: boolean | null; validators: number | null; votes: { chain: string; index: number; ayes: bigint; nays: bigint }[] | null; treasury: bigint | null };
const vote = (chain: string, index: number, ayes = 0n, nays = 0n) => ({ chain, index, ayes, nays });
const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve(null),
  calls: 0,
}));
vi.mock('../data/network', () => ({ loadNetwork: () => { impl.calls++; return impl.load(); } }));

const full: Overview = { live: true, validators: 4, votes: [], treasury: 7_000_000_000_000n };
const renderIt = () => render(<MemoryRouter><Network /></MemoryRouter>);
const card = (name: string) => screen.getByRole('heading', { name }).closest('section') as HTMLElement;

describe('Network', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en'); impl.calls = 0;
    impl.load = () => Promise.resolve(full);
  });

  it('shows the light, validators, treasury and the vote hint', async () => {
    renderIt();
    expect(await screen.findByText('The network is working')).toBeInTheDocument();
    expect(screen.getByText('4 active')).toBeInTheDocument();
    expect(within(card('Treasury')).getByTitle('7 HEZ')).toHaveTextContent('7 HEZ');
    expect(screen.getByText('No active votes right now.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'To vote, use apps.pezkuwichain.io' });
    expect(link).toHaveAttribute('href', 'https://apps.pezkuwichain.io/#/referenda');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('treasury null greys out only the treasury card', async () => {
    impl.load = () => Promise.resolve({ ...full, treasury: null });
    renderIt();
    expect(await screen.findByText('4 active')).toBeInTheDocument();
    expect(within(card('Treasury')).getByText(/could not be loaded/)).toBeInTheDocument();
    expect(within(card('Treasury')).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(within(card('Votes')).queryByText(/could not be loaded/)).toBeNull();
    expect(within(card('Validators')).queryByText(/could not be loaded/)).toBeNull();
    expect(screen.getByText('The network is working')).toBeInTheDocument();
  });

  it('votes null shows the error in the votes card only', async () => {
    impl.load = () => Promise.resolve({ ...full, votes: null });
    renderIt();
    expect(await screen.findByTitle('7 HEZ')).toBeInTheDocument();
    expect(within(card('Votes')).getByText(/could not be loaded/)).toBeInTheDocument();
    expect(within(card('Treasury')).queryByText(/could not be loaded/)).toBeNull();
  });

  it('live null shows the not-answering light while other cards render', async () => {
    impl.load = () => Promise.resolve({ ...full, live: null });
    renderIt();
    expect(await screen.findByText('The network is not answering')).toBeInTheDocument();
    expect(screen.getByText('4 active')).toBeInTheDocument();
  });

  it('a count of active votes is shown as a sentence, not a bare number', async () => {
    impl.load = () => Promise.resolve({ ...full, votes: [vote('relay', 1), vote('people', 2)] });
    renderIt();
    expect(await screen.findByText('2 active votes')).toBeInTheDocument();
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.queryByText('No active votes right now.')).toBeNull();
  });

  it('each ongoing vote shows its number and the Aye/Nay split of its tally', async () => {
    impl.load = () => Promise.resolve({ ...full, votes: [vote('assetHub', 7, 68n, 32n), vote('relay', 9)] });
    renderIt();
    const rows = await within(await screen.findByRole('list')).findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('#7');
    expect(rows[0]).toHaveTextContent('Asset Hub');
    expect(rows[0].querySelector('img[src="/chains/assethub.png"]')).not.toBeNull();
    expect(rows[1]).toHaveTextContent('Relay');
    expect(rows[0]).toHaveTextContent('Aye 68%');
    expect(rows[0]).toHaveTextContent('Nay 32%');
    // Nobody has voted yet: no percentages are invented.
    expect(rows[1]).toHaveTextContent('#9');
    expect(rows[1]).not.toHaveTextContent('%');
  });

  it('shows a large treasury compactly, with the exact amount as its title', async () => {
    impl.load = () => Promise.resolve({ ...full, treasury: 40_258_000n * 10n ** 12n });
    renderIt();
    const value = await screen.findByTitle('40,258,000 HEZ');
    expect(value).toHaveTextContent('≈40.2M HEZ');
  });

  it('retry reloads', async () => {
    impl.load = () => Promise.resolve({ ...full, treasury: null });
    renderIt();
    await screen.findByText('4 active');
    impl.load = () => Promise.resolve(full);
    fireEvent.click(within(card('Treasury')).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTitle('7 HEZ')).toBeInTheDocument();
    expect(impl.calls).toBe(2);
  });

  it('a rejected load errors every card and the light reads down', async () => {
    impl.load = () => Promise.reject(new Error('x'));
    renderIt();
    expect(await screen.findByText('The network is not answering')).toBeInTheDocument();
    expect(screen.getAllByText(/could not be loaded/)).toHaveLength(3);
  });

  it('renders the vote count in Sorani digits inside the sentence', async () => {
    await i18n.changeLanguage('ckb');
    impl.load = () => Promise.resolve({ ...full, votes: [vote('relay', 1), vote('people', 2), vote('assetHub', 3)] });
    renderIt();
    expect(await screen.findByText(/٣/)).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('renders the validator count in Sorani digits', async () => {
    await i18n.changeLanguage('ckb');
    impl.load = () => Promise.resolve({ ...full, validators: 12 });
    renderIt();
    expect(await screen.findByText('١٢ چالاک')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});

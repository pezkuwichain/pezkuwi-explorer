import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import Network from './Network';

type Overview = { live: boolean | null; validators: number | null; votes: { chain: string; index: number; ayes: bigint; nays: bigint }[] | null; treasury: bigint | null };
const vote = (chain: string, index: number, ayes = 0n, nays = 0n) => ({ chain, index, ayes, nays });
const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve(null),
  calls: 0,
}));
vi.mock('../data/network', () => ({ loadNetwork: () => { impl.calls++; return impl.load(); } }));
// The switch itself (storage + reload) is tested in src/config/network.test.ts; here only that it is asked for.
const sw = vi.hoisted(() => ({ calls: [] as string[], ok: true }));
vi.mock('../config/network', async (orig) => ({
  ...(await orig<typeof import('../config/network')>()),
  switchNetwork: (to: string) => { sw.calls.push(to); return sw.ok; },
}));

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const full: Overview = { live: true, validators: 4, votes: [], treasury: 7_000_000_000_000n };
const renderIt = () => render(<MemoryRouter><AccountProvider><Network /></AccountProvider></MemoryRouter>);
const card = (name: string) => screen.getByRole('heading', { name }).closest('section') as HTMLElement;

describe('Network', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en'); impl.calls = 0; sw.calls = []; sw.ok = true; localStorage.clear();
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

  describe('mainnet / testnet switch', () => {
    const group = () => screen.getByRole('radiogroup', { name: 'Network' });
    it('shows both networks at the top, the one being read checked (a first visit reads mainnet)', () => {
      renderIt();
      const radios = within(group()).getAllByRole('radio');
      expect(radios.map((r) => r.textContent)).toEqual(['Mainnet', 'Testnet (Zagros)']);
      expect(within(group()).getByRole('radio', { name: 'Mainnet' })).toHaveAttribute('aria-checked', 'true');
      expect(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' })).toHaveAttribute('aria-checked', 'false');
      // First thing in the screen, above the live light.
      expect(document.querySelector('.screen.network')!.firstElementChild).toBe(group());
    });
    it('choosing the network already read does nothing', () => {
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Mainnet' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sw.calls).toEqual([]);
    });
    it('asks before switching, because the page reloads; Cancel keeps the network', () => {
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      const d = screen.getByRole('dialog', { name: 'Change the network?' });
      expect(d).toHaveTextContent('The page reloads');
      expect(d).toHaveTextContent('i-Wallet always stays on the mainnet');
      expect(d).not.toHaveTextContent('signed out');
      fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sw.calls).toEqual([]);
    });
    it('confirming switches to the chosen network; a pasted address stays open (both networks use SS58 42)', async () => {
      storage.set('account', ALICE); storage.set('account-source', 'address');
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Change and reload' }));
      await waitFor(() => expect(sw.calls).toEqual(['zagros']));
      expect(storage.get('account')).toBe(ALICE);
    });
    it('a signed-in wallet is told, and signed out before the reload', async () => {
      storage.set('account', ALICE); storage.set('account-source', 'extension');
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      const d = screen.getByRole('dialog');
      expect(d).toHaveTextContent('Your wallet is signed out first; connect it again afterwards.');
      fireEvent.click(within(d).getByRole('button', { name: 'Change and reload' }));
      await waitFor(() => expect(sw.calls).toEqual(['zagros']));
      expect(storage.get('account')).toBeNull();
      expect(storage.get('account-source')).toBeNull();
    });
    it('says so when the browser would not keep the choice', async () => {
      sw.ok = false;
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Change and reload' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('This browser would not keep the choice');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

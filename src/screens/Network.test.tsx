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
// Writing the choice and reloading are tested in src/config/network.test.ts; here only that, and in which order,
// the screen asks for them. `events` records the order of write, disconnect and reload.
const sw = vi.hoisted(() => ({ events: [] as string[], ok: true, disconnect: (): Promise<void> => Promise.resolve() }));
vi.mock('../config/network', async (orig) => ({
  ...(await orig<typeof import('../config/network')>()),
  rememberNetwork: (to: string) => { sw.events.push(`write:${to}`); return sw.ok; },
  reloadPage: () => { sw.events.push('reload'); },
}));
vi.mock('../account/connectors/walletconnect', async (orig) => ({
  ...(await orig<typeof import('../account/connectors/walletconnect')>()),
  // Like the real one: the first call forgets the session at once, so a later call (forget's own) has nothing to end.
  disconnectWalletConnect: () => {
    if (sw.events.includes('disconnect')) return Promise.resolve();
    sw.events.push('disconnect');
    return sw.disconnect().then(() => { sw.events.push('disconnected'); });
  },
  restoreWalletConnect: () => Promise.resolve({ state: 'live', accounts: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'], peerName: 'pezWallet' }),
}));
const switched = () => sw.events.filter((e) => e.startsWith('write') || e === 'reload');

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const full: Overview = { live: true, validators: 4, votes: [], treasury: 7_000_000_000_000n };
const renderIt = () => render(<MemoryRouter><AccountProvider><Network /></AccountProvider></MemoryRouter>);
const card = (name: string) => screen.getByRole('heading', { name }).closest('section') as HTMLElement;

describe('Network', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en'); impl.calls = 0; sw.events = []; sw.ok = true; sw.disconnect = () => Promise.resolve(); localStorage.clear(); vi.useRealTimers();
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
      expect(radios.map((r) => r.textContent)).toEqual(['Mainnet (Pezkuwi)', 'Testnet (Zagros)']);
      expect(within(group()).getByRole('radio', { name: 'Mainnet (Pezkuwi)' })).toHaveAttribute('aria-checked', 'true');
      expect(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' })).toHaveAttribute('aria-checked', 'false');
      // First thing in the screen, above the live light.
      expect(document.querySelector('.screen.network')!.firstElementChild).toBe(group());
    });
    it('choosing the network already read does nothing', () => {
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Mainnet (Pezkuwi)' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sw.events).toEqual([]);
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
      expect(sw.events).toEqual([]);
    });
    it('confirming switches to the chosen network; a pasted address stays open (both networks use SS58 42)', async () => {
      storage.set('account', ALICE); storage.set('account-source', 'address');
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Change and reload' }));
      await waitFor(() => expect(switched()).toEqual(['write:zagros', 'reload']));
      expect(storage.get('account')).toBe(ALICE);
    });
    it('a signed-in wallet is told, and signed out before the reload', async () => {
      storage.set('account', ALICE); storage.set('account-source', 'extension');
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      const d = screen.getByRole('dialog');
      expect(d).toHaveTextContent('Your wallet is signed out first; connect it again afterwards.');
      fireEvent.click(within(d).getByRole('button', { name: 'Change and reload' }));
      await waitFor(() => expect(switched()).toEqual(['write:zagros', 'reload']));
      expect(storage.get('account')).toBeNull();
      expect(storage.get('account-source')).toBeNull();
    });
    it('says so when the browser would not keep the choice, and signs nobody out', async () => {
      sw.ok = false;
      storage.set('account', ALICE); storage.set('account-source', 'extension');
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Change and reload' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('This browser would not keep the choice');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sw.events).toEqual(['write:zagros']);
      expect(storage.get('account')).toBe(ALICE);
    });
    it('WalletConnect: writes the choice, then waits for the disconnect, then reloads', async () => {
      storage.set('account', ALICE); storage.set('account-source', 'walletconnect'); storage.set('wc-session', 'topic');
      let end!: () => void;
      sw.disconnect = () => new Promise<void>((r) => { end = r; });
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      const d = screen.getByRole('dialog');
      expect(d).toHaveTextContent('Your wallet is signed out first');
      fireEvent.click(within(d).getByRole('button', { name: 'Change and reload' }));
      await waitFor(() => expect(sw.events[0]).toBe('write:zagros'));
      expect(sw.events[1]).toBe('disconnect');
      expect(sw.events).not.toContain('reload');
      expect(storage.get('account')).toBeNull();
      end();
      await waitFor(() => expect(sw.events).toContain('reload'));
      expect(sw.events.indexOf('disconnected')).toBeLessThan(sw.events.indexOf('reload'));
    });
    it('WalletConnect: a disconnect that never answers delays the reload by at most 2 s', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      storage.set('account', ALICE); storage.set('account-source', 'walletconnect'); storage.set('wc-session', 'topic');
      sw.disconnect = () => new Promise<void>(() => {});
      renderIt();
      fireEvent.click(within(group()).getByRole('radio', { name: 'Testnet (Zagros)' }));
      vi.useFakeTimers();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Change and reload' }));
      await vi.advanceTimersByTimeAsync(0);
      expect(sw.events.slice(0, 2)).toEqual(['write:zagros', 'disconnect']);
      await vi.advanceTimersByTimeAsync(1999);
      expect(sw.events).not.toContain('reload');
      await vi.advanceTimersByTimeAsync(1);
      expect(sw.events).toContain('reload');
      expect(sw.events).not.toContain('disconnected');
      vi.useRealTimers();
    });
  });

  describe('keyboard', () => {
    const group = () => screen.getByRole('radiogroup', { name: 'Network' });
    const radio = (name: string) => within(group()).getByRole('radio', { name });
    it('one tab stop: only the checked radio is in the tab order', () => {
      renderIt();
      expect(radio('Mainnet (Pezkuwi)')).toHaveAttribute('tabindex', '0');
      expect(radio('Testnet (Zagros)')).toHaveAttribute('tabindex', '-1');
    });
    it.each(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'End'])('%s moves to the other network and asks to switch', (key) => {
      renderIt();
      radio('Mainnet (Pezkuwi)').focus();
      fireEvent.keyDown(radio('Mainnet (Pezkuwi)'), { key });
      expect(radio('Testnet (Zagros)')).toHaveFocus();
      expect(screen.getByRole('dialog', { name: 'Change the network?' })).toBeInTheDocument();
    });
    it('Home stays on the first (current) network: no question', () => {
      renderIt();
      radio('Mainnet (Pezkuwi)').focus();
      fireEvent.keyDown(radio('Mainnet (Pezkuwi)'), { key: 'Home' });
      expect(radio('Mainnet (Pezkuwi)')).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('other keys do nothing', () => {
      renderIt();
      fireEvent.keyDown(radio('Mainnet (Pezkuwi)'), { key: 'a' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('right to left: ArrowLeft moves forward', () => {
      document.documentElement.dir = 'rtl';
      try {
        renderIt();
        radio('Mainnet (Pezkuwi)').focus();
        fireEvent.keyDown(radio('Mainnet (Pezkuwi)'), { key: 'ArrowLeft' });
        expect(radio('Testnet (Zagros)')).toHaveFocus();
      } finally { document.documentElement.dir = 'ltr'; }
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { user } from '../test-user';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import Receive from './Receive';
import Settings from './Settings';
import { WrongPasswordError } from '../keystore';
import type { KvStore } from '../idb';

const ADDR = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const impl = vi.hoisted(() => ({
  holdings: null as null | (() => Promise<unknown>),
  assets: (): Promise<unknown> => Promise.reject(new Error('asset hub down')), assetReads: 0,
  words: vi.fn(), enrol: vi.fn(), faceSupported: false, faceOn: false, forgot: 0,
}));
vi.mock('../data', () => ({ loadWalletHoldings: () => impl.holdings!(), loadAssetHoldings: () => { impl.assetReads++; return impl.assets(); } }));
vi.mock('../faceid', () => ({
  hasFaceId: () => Promise.resolve(impl.faceOn), unlockWithFaceId: () => Promise.resolve(null),
  faceIdSupported: () => Promise.resolve(impl.faceSupported),
  enrolFaceId: (...a: unknown[]) => impl.enrol(...a), forgetFaceId: () => { impl.forgot++; impl.faceOn = false; return Promise.resolve(true); },
}));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  loadKeystore: () => Promise.resolve({ address: ADDR, encoded: 'enc' }),
  readSealedWords: () => Promise.resolve({ sealed: true }),
  openWords: (_enc: unknown, pw: string) => impl.words(pw),
  unlock: () => Promise.resolve({ address: ADDR, lock() {} }),
  verifyPassword: () => Promise.resolve(),
}));

const T = 10n ** 12n;
// What loadWalletHoldings returns: the Account tab's shape (HEZ with its split, then PEZ and USDT, zero kept).
const holdingsOk = (relay: bigint, people: bigint, pez = 2n * T) => () => Promise.resolve([
  { symbol: 'HEZ', decimals: 12, amount: 5n * T + relay + people, perChain: { relay, assetHub: 5n * T, people } },
  { symbol: 'PEZ', decimals: 12, amount: pez },
  { symbol: 'USDT', decimals: 6, amount: 3_000_000n, standard: 'PEZ-20' },
]);

let store: Map<string, unknown>;
const makeStore = (): KvStore => ({
  get: (k) => Promise.resolve(store.get(k)),
  set: (k, v) => { store.set(k, v); return Promise.resolve(); },
  delete: (k) => { store.delete(k); return Promise.resolve(); },
  deleteMany: (ks) => { ks.forEach((k) => store.delete(k)); return Promise.resolve(); },
  setMany: (e, rm = []) => { Object.entries(e).forEach(([k, v]) => store.set(k, v)); rm.forEach((k) => store.delete(k)); return Promise.resolve(); },
});
function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <IWalletProvider store={makeStore()}>
      <Routes>
        <Route path="i-wallet" element={<IWalletShell />}>
          <Route index element={<IWalletIndex />} />
          <Route path="receive" element={<Receive />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Where />
    </IWalletProvider>
  </MemoryRouter>,
);
const unlock = async () => {
  await user.type(await screen.findByLabelText('Parola'), 'right-pass1');
  await user.click(screen.getByRole('button', { name: 'Kilidi aç' }));
};

describe('i-Wallet home', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    store = new Map<string, unknown>([['keystore', {}], ['words', {}], ['faceid', {}]]);
    impl.holdings = holdingsOk(0n, 0n); impl.words.mockReset();
    impl.assets = () => Promise.reject(new Error('asset hub down')); impl.assetReads = 0;
    window.matchMedia = (() => ({ matches: false })) as never;
  });

  it('shows the Account card: the HEZ total, its split on all three networks (zero included) and the actions', async () => {
    impl.holdings = holdingsOk(2n * T, 0n);
    renderAt('/i-wallet');
    await unlock();
    expect(await screen.findByTitle('7 HEZ')).toBeInTheDocument();
    // The same tiles as the Account tab, in its order; People holds nothing and still has its tile.
    expect([...document.querySelectorAll('.total-card .chain-tile')].map((c) => c.textContent)).toEqual(['Relay2', 'Asset Hub5', 'People0']);
    expect(screen.getByRole('link', { name: /Gönder/ })).toHaveAttribute('href', '/i-wallet/send');
    expect(screen.getByRole('link', { name: /Vatandaşlık/ })).toHaveAttribute('href', '/i-wallet/citizen');
    expect(screen.getByRole('link', { name: /^Al/ })).toHaveAttribute('href', '/i-wallet/receive');
    expect(within(document.querySelector('.total-card') as HTMLElement).getByRole('button', { name: 'Adresi kopyala' })).toBeInTheDocument();
  });

  it('lists HEZ first, then PEZ and USDT (even at zero) with the Account tab\'s network labels', async () => {
    impl.holdings = holdingsOk(0n, 0n, 0n);
    renderAt('/i-wallet');
    await unlock();
    const list = await screen.findByRole('region', { name: 'Varlıklar' });
    expect(within(list).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['HEZPezkuwiChain5', 'PEZAsset Hub0', 'USDTAsset Hub (PEZ-20)3']);
  });

  it('shows could-not-load with retry instead of a partial HEZ total, and keeps the address and actions', async () => {
    let calls = 0;
    impl.holdings = () => { calls++; return calls === 1 ? Promise.reject(new Error('relay down')) : holdingsOk(0n, 0n)(); };
    renderAt('/i-wallet');
    await unlock();
    expect(await screen.findByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
    expect(screen.queryByText('HEZ', { selector: '.sym' })).toBeNull();
    expect(document.querySelector('.chain-tile')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Varlıklar' })).toBeNull();
    // Address and actions need no balance: they stay while the HEZ figure is unavailable.
    expect(screen.getByRole('link', { name: /^Al/ })).toHaveAttribute('href', '/i-wallet/receive');
    expect(screen.getByRole('link', { name: /Gönder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adresi kopyala' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByTitle('5 HEZ')).toBeInTheDocument();
  });

  it('when the HEZ card fails, still lists PEZ and USDT from Asset Hub alone, with no HEZ row', async () => {
    impl.holdings = () => Promise.reject(new Error('people down'));
    impl.assets = () => Promise.resolve([
      { symbol: 'PEZ', decimals: 12, amount: 2n * T }, { symbol: 'USDT', decimals: 6, amount: 3_000_000n, standard: 'PEZ-20' },
    ]);
    renderAt('/i-wallet');
    await unlock();
    // The card stays fail-closed: no HEZ figure, the retry is offered.
    expect(await screen.findByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
    expect(document.querySelector('.chain-tile')).toBeNull();
    const list = await screen.findByRole('region', { name: 'Varlıklar' });
    expect(within(list).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['PEZAsset Hub2', 'USDTAsset Hub (PEZ-20)3']);
    expect(impl.assetReads).toBe(1);
  });

  it('does not read Asset Hub on its own when the HEZ card loads', async () => {
    renderAt('/i-wallet');
    await unlock();
    await screen.findByTitle('5 HEZ');
    expect(impl.assetReads).toBe(0);
  });

  it('shows the Home Screen hint in a browser tab and hides it in standalone mode', async () => {
    const first = renderAt('/i-wallet');
    await unlock();
    expect(await screen.findByText(/Ana Ekrana ekle/)).toBeInTheDocument();
    first.unmount();
    window.matchMedia = ((q: string) => ({ matches: q.includes('standalone') })) as never;
    renderAt('/i-wallet');
    await unlock();
    await screen.findByText('PEZ');
    expect(screen.queryByText(/Ana Ekrana ekle/)).toBeNull();
  });
});

describe('locked wallet screens', () => {
  beforeEach(async () => { await i18n.changeLanguage('tr'); store = new Map(); impl.holdings = holdingsOk(0n, 0n); });

  it.each(['/i-wallet/receive', '/i-wallet/settings'])('%s shows the unlock form, never the data, while locked', async (path) => {
    renderAt(path);
    expect(await screen.findByLabelText('Parola')).toBeInTheDocument();
    expect(screen.queryByText(ADDR)).toBeNull();
    expect(screen.queryByRole('img', { name: 'Adresinin QR kodu' })).toBeNull();
  });
});

describe('i-Wallet receive', () => {
  beforeEach(async () => { await i18n.changeLanguage('tr'); store = new Map(); });

  it('shows the QR and the full address once unlocked, and copies only the address', async () => {
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } });
    renderAt('/i-wallet/receive');
    await unlock();
    expect(await screen.findByRole('img', { name: 'Adresinin QR kodu' })).toBeInTheDocument();
    expect(screen.getByText(ADDR)).toBeInTheDocument();
    expect(screen.getByText('Bu tek adres üç Pezkuwi ağının hepsinde alır: Relay, Asset Hub ve People.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adresi kopyala' }));
    expect(write).toHaveBeenCalledWith(ADDR);
  });
});

describe('i-Wallet settings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    store = new Map<string, unknown>([['keystore', {}], ['words', {}], ['faceid', {}], ['other', 1]]);
    impl.words.mockReset(); impl.enrol.mockReset(); impl.faceSupported = false; impl.faceOn = false;
  });

  it('asks for the password before showing the words, and drops them when hidden', async () => {
    impl.words.mockRejectedValueOnce(new WrongPasswordError());
    impl.words.mockResolvedValueOnce('one two three four five six seven eight nine ten eleven twelve');
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: /Yedek kelimeleri göster/ }));
    expect(screen.queryByText('seven')).toBeNull();
    await user.type(screen.getByLabelText('Parola'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Göster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Parola yanlış');
    await user.type(screen.getByLabelText('Parola'), 'right-pass1');
    await user.click(screen.getByRole('button', { name: 'Göster' }));
    expect(await screen.findByText('seven')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kopyala/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Gizle' }));
    expect(screen.queryByText('seven')).toBeNull();
  });

  it('lock returns to the unlock form', async () => {
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: /Cüzdanı kilitle/ }));
    expect(await screen.findByLabelText('Parola')).toBeInTheDocument();
  });

  it('delete needs the confirmation, then clears the keystore, the words and the Face ID record', async () => {
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: /Cihazdan sil/ }));
    expect(store.has('keystore')).toBe(true);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('12 kelime geri dönmenin tek yoludur');
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(store.has('keystore')).toBe(true);
    await user.click(screen.getByRole('button', { name: /Cihazdan sil/ }));
    await user.click(await screen.findByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(store.has('keystore')).toBe(false));
    expect(store.has('words')).toBe(false);
    expect(store.has('faceid')).toBe(false);
    expect(store.has('other')).toBe(true);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/i-wallet$/));
  });

  it('hides the words when the page becomes hidden', async () => {
    impl.words.mockResolvedValue('one two three four five six seven eight nine ten eleven twelve');
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: /Yedek kelimeleri göster/ }));
    await user.type(screen.getByLabelText('Parola'), 'right-pass1');
    await user.click(screen.getByRole('button', { name: 'Göster' }));
    expect(await screen.findByText('seven')).toBeInTheDocument();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    expect(screen.queryByText('seven')).toBeNull();
    expect(screen.getByRole('button', { name: /Yedek kelimeleri göster/ })).toBeInTheDocument();
  });

  it('drops a verified Face ID password when the page becomes hidden', async () => {
    impl.faceSupported = true; impl.faceOn = false; impl.words.mockResolvedValue('x'); impl.enrol.mockReset();
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: "Face ID'yi aç" }));
    await user.type(screen.getByLabelText('Parola'), 'right-pass1');
    await user.click(screen.getByRole('button', { name: 'Devam' }));
    await screen.findByRole('button', { name: "Face ID'yi aç" });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    // Back at the menu, and asking again starts from the password prompt.
    await user.click(await screen.findByRole('button', { name: "Face ID'yi aç" }));
    expect(screen.getByLabelText('Parola')).toHaveValue('');
    expect(impl.enrol).not.toHaveBeenCalled();
  });

  it('hides the Face ID control where it is unsupported', async () => {
    impl.faceSupported = false;
    renderAt('/i-wallet/settings');
    await unlock();
    await screen.findByRole('button', { name: /Cihazdan sil/ });
    expect(screen.queryByRole('button', { name: /Face ID/ })).toBeNull();
  });

  it('enables Face ID: password first, then a separate tap', async () => {
    impl.faceSupported = true; impl.faceOn = false; impl.words.mockResolvedValue('x'); impl.enrol.mockResolvedValue({ ok: true });
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: 'Face ID\'yi aç' }));
    await user.type(screen.getByLabelText('Parola'), 'right-pass1');
    await user.click(screen.getByRole('button', { name: 'Devam' }));
    expect(impl.enrol).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Face ID\'yi aç' }));
    expect(impl.enrol).toHaveBeenCalledWith('right-pass1');
    expect(await screen.findByRole('status')).toHaveTextContent('Face ID açık');
  });

  it('turns Face ID off by forgetting the record', async () => {
    impl.faceSupported = true; impl.faceOn = true; impl.forgot = 0;
    renderAt('/i-wallet/settings');
    await unlock();
    await user.click(await screen.findByRole('button', { name: "Face ID'yi kapat" }));
    expect(impl.forgot).toBe(1);
    expect(await screen.findByRole('button', { name: "Face ID'yi aç" })).toBeInTheDocument();
  });
});

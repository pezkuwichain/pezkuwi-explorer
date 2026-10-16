import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  hez: null as null | (() => Promise<unknown>),
  assets: null as null | (() => Promise<unknown>),
  words: vi.fn(),
}));
vi.mock('../data', () => ({ loadHezBalance: () => impl.hez!(), loadAssetBalances: () => impl.assets!() }));
vi.mock('../faceid', () => ({ hasFaceId: () => Promise.resolve(false), unlockWithFaceId: () => Promise.resolve(null), faceIdSupported: () => Promise.resolve(false) }));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  loadKeystore: () => Promise.resolve({ address: ADDR, encoded: 'enc' }),
  loadWords: (...a: unknown[]) => impl.words(...a),
  unlock: () => Promise.resolve({ address: ADDR, lock() {} }),
}));

const T = 10n ** 12n;
const hezOk = (relay: bigint, people: bigint) => () => Promise.resolve({
  total: 5n * T + relay + people, perChain: { relay, assetHub: 5n * T, people }, assetHubFree: 5n * T,
});
const assetsOk = () => Promise.resolve([
  { id: 1, symbol: 'PEZ', decimals: 12, amount: 2n * T }, { id: 1000, symbol: 'USDT', decimals: 6, amount: 3_000_000n },
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
    impl.hez = hezOk(0n, 0n); impl.assets = assetsOk; impl.words.mockReset();
    window.matchMedia = (() => ({ matches: false })) as never;
  });

  it('shows the HEZ total, the asset rows and the actions once unlocked', async () => {
    renderAt('/i-wallet');
    await unlock();
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('PEZ')).toBeInTheDocument();
    expect(screen.getByText('USDT')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gönder/ })).toHaveAttribute('href', '/i-wallet/send');
    expect(screen.getByRole('link', { name: /Vatandaşlık/ })).toHaveAttribute('href', '/i-wallet/citizen');
    expect(screen.getByRole('link', { name: /^Al/ })).toHaveAttribute('href', '/i-wallet/receive');
    expect(screen.queryByRole('list', { name: 'HEZ dağılımı' })).toBeNull();
  });

  it('lists the per-chain parts only when relay or People hold HEZ', async () => {
    impl.hez = hezOk(2n * T, 0n);
    renderAt('/i-wallet');
    await unlock();
    expect(await screen.findByRole('list', { name: 'HEZ dağılımı' })).toBeInTheDocument();
  });

  it('shows could-not-load with retry instead of a partial HEZ total, and keeps the asset rows', async () => {
    impl.hez = () => Promise.reject(new Error('relay down'));
    renderAt('/i-wallet');
    await unlock();
    expect(await screen.findByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
    expect(screen.queryByText('HEZ', { selector: '.sym' })).toBeNull();
    expect(await screen.findByText('PEZ')).toBeInTheDocument();
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
  beforeEach(async () => { await i18n.changeLanguage('tr'); store = new Map(); impl.hez = hezOk(0n, 0n); impl.assets = assetsOk; });

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
    await user.click(screen.getByRole('button', { name: 'Adresi kopyala' }));
    expect(write).toHaveBeenCalledWith(ADDR);
  });
});

describe('i-Wallet settings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    store = new Map<string, unknown>([['keystore', {}], ['words', {}], ['faceid', {}], ['other', 1]]);
    impl.words.mockReset();
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
});

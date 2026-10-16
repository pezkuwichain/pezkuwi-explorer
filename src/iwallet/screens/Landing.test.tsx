import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n, { setLanguage } from '../../i18n';
import { PLAY_STORE } from '../../account/AccountContext';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import type { KvStore } from '../idb';

const impl = vi.hoisted(() => ({ load: (): Promise<unknown> => Promise.resolve(null) }));
vi.mock('../keystore', async (orig) => ({ ...(await orig<typeof import('../keystore')>()), loadKeystore: () => impl.load() }));

const renderTab = () => render(
  <MemoryRouter initialEntries={['/i-wallet']}>
    <IWalletProvider store={{} as KvStore}>
      <Routes><Route path="i-wallet" element={<IWalletShell />}><Route index element={<IWalletIndex />} /></Route></Routes>
    </IWalletProvider>
  </MemoryRouter>,
);

describe('i-Wallet landing', () => {
  beforeEach(async () => { await i18n.changeLanguage('tr'); impl.load = () => Promise.resolve(null); });

  it("shows Serok's warning, the Android link and both calls to action", async () => {
    renderTab();
    expect(await screen.findByText('iPhone kullanıcıları için geçici hizmet')).toBeInTheDocument();
    expect(screen.getByText(/Sıcak cüzdanlar doğası gereği yüksek güvenlik sunmaz/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Android uygulamasını indir' })).toHaveAttribute('href', PLAY_STORE);
    expect(screen.getByRole('link', { name: 'i-Wallet edin' })).toHaveAttribute('href', '/i-wallet/create');
    expect(screen.getByRole('link', { name: /Zaten cüzdanım var/ })).toHaveAttribute('href', '/i-wallet/import');
    expect(screen.getByText('Pezkuwi ana ağ')).toBeInTheDocument();
  });

  it('hides the create and import paths when storage is unavailable', async () => {
    impl.load = () => Promise.reject(new Error('no idb'));
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu tarayıcıda depolama kullanılamıyor');
    expect(screen.queryByRole('link', { name: 'i-Wallet edin' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Zaten cüzdanım var/ })).toBeNull();
    expect(screen.getByText('iPhone kullanıcıları için geçici hizmet')).toBeInTheDocument();
  });

  it('shows the locked placeholder when a keystore is stored', async () => {
    impl.load = () => Promise.resolve({ address: 'x' });
    renderTab();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'i-Wallet kilitli' })).toBeInTheDocument());
  });

  it('renders in right-to-left Arabic with both calls to action', async () => {
    setLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    renderTab();
    const create = await screen.findByRole('link', { name: 'احصل على i-Wallet' });
    expect(create).toHaveAttribute('href', '/i-wallet/create');
    expect(screen.getByRole('link', { name: /لدي محفظة بالفعل/ })).toHaveAttribute('href', '/i-wallet/import');
    expect(screen.getByRole('note')).toBeInTheDocument();
    setLanguage('kmr');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { user } from '../test-user';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import { CorruptKeystoreError, WrongPasswordError } from '../keystore';
import type { KvStore } from '../idb';

const impl = vi.hoisted(() => ({ unlock: vi.fn(), face: false }));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  loadKeystore: () => Promise.resolve({ address: 'x' }),
  unlock: impl.unlock,
  verifyPassword: (...a: unknown[]) => Promise.resolve(impl.unlock(...a)).then(() => undefined),
}));
vi.mock('../faceid', () => ({ hasFaceId: () => Promise.resolve(impl.face), unlockWithFaceId: () => Promise.resolve(null), faceIdSupported: () => Promise.resolve(false) }));

const renderTab = () => render(
  <MemoryRouter initialEntries={['/i-wallet']}>
    <IWalletProvider store={{} as KvStore}>
      <Routes><Route path="i-wallet" element={<IWalletShell />}><Route index element={<IWalletIndex />} /></Route></Routes>
    </IWalletProvider>
  </MemoryRouter>,
);

describe('i-Wallet unlock', () => {
  beforeEach(async () => { await i18n.changeLanguage('tr'); impl.unlock.mockReset(); impl.face = false; });

  it('shows the wrong-password error and lets the user retry', async () => {
    impl.unlock.mockRejectedValueOnce(new WrongPasswordError());
    const u = user;
    renderTab();
    await u.type(await screen.findByLabelText('Parola'), 'nope');
    await u.click(screen.getByRole('button', { name: 'Kilidi aç' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Parola yanlış');
    expect(screen.getByRole('button', { name: 'Kilidi aç' })).toBeEnabled();
  });

  it('points a corrupt keystore to the 12-word restore', async () => {
    impl.unlock.mockRejectedValueOnce(new CorruptKeystoreError());
    const u = user;
    renderTab();
    await u.type(await screen.findByLabelText('Parola'), 'whatever1');
    await u.click(screen.getByRole('button', { name: 'Kilidi aç' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('okunamıyor');
    expect(screen.getAllByRole('link', { name: '12 kelimeyle geri yükle' })[0]).toHaveAttribute('href', '/i-wallet/import');
  });

  it('shows the Face ID button only when enrolled', async () => {
    renderTab();
    await screen.findByLabelText('Parola');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // let hasFaceId() resolve
    expect(screen.queryByRole('button', { name: /Face ID/ })).toBeNull();
  });

  it('offers Face ID when enrolled', async () => {
    impl.face = true;
    renderTab();
    expect(await screen.findByRole('button', { name: /Face ID/ })).toBeInTheDocument();
  });
});

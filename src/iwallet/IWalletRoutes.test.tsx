import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { IWalletProvider } from './IWalletContext';
import IWalletShell from './IWalletRoutes';
import type { KvStore } from './idb';

const net = vi.hoisted(() => ({ changed: false }));
vi.mock('./chain', () => ({ networkChanged: () => net.changed, subscribeNetworkChanged: () => () => undefined, getMainnetApi: vi.fn() }));
vi.mock('./keystore', async (orig) => ({ ...(await orig<typeof import('./keystore')>()), loadKeystore: () => Promise.resolve(null) }));

const renderShell = () => render(
  <MemoryRouter initialEntries={['/i-wallet']}>
    <IWalletProvider store={{} as KvStore}>
      <Routes><Route path="i-wallet" element={<IWalletShell />}><Route index element={<p>page</p>} /></Route></Routes>
    </IWalletProvider>
  </MemoryRouter>,
);

describe('IWalletShell', () => {
  it('says the network changed when a mainnet endpoint answered with another chain', async () => {
    await i18n.changeLanguage('en');
    net.changed = true;
    renderShell();
    expect(await screen.findByRole('alert')).toHaveTextContent(/network has changed/);
  });
  it('shows nothing extra on the expected network', async () => {
    await i18n.changeLanguage('en');
    net.changed = false;
    renderShell();
    await screen.findByText('page');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

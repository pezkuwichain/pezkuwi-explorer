import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { user } from './test-user';
import { IWalletProvider } from './IWalletContext';
import IWalletShell, { IWalletIndex } from './IWalletRoutes';
import type { KvStore } from './idb';

// The keystore code loads on demand. If that download fails (a tab older than a deploy, offline without the service
// worker), the tab says the wallet could not be loaded and offers a retry; it never claims the browser cannot store a
// wallet, and the retry imports the code again.
describe('i-Wallet code that fails to load', () => {
  it('shows "could not load" with a retry that imports again, then the landing', async () => {
    await i18n.changeLanguage('en');
    const loadKeystore = vi.fn().mockResolvedValue(null);
    const loadCode = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue({ loadKeystore });
    render(
      <MemoryRouter initialEntries={['/i-wallet']}>
        <IWalletProvider store={{} as KvStore} loadCode={loadCode as never}>
          <Routes><Route path="i-wallet" element={<IWalletShell />}><Route index element={<IWalletIndex />} /></Route></Routes>
        </IWalletProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('i-Wallet could not be loaded');
    expect(screen.queryByText(/Storage is unavailable/)).toBeNull();
    expect(loadKeystore).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Get an i-Wallet' })).toHaveAttribute('href', '/i-wallet/create');
    expect(loadCode).toHaveBeenCalledTimes(2);
    expect(loadKeystore).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { user } from '../test-user';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell from '../IWalletRoutes';
import Import from './Import';
import type { KvStore } from '../idb';

const WORDS = 'orbit fabric lunar vessel harbor candle meadow tribe glance salute oyster wisdom';
const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve(null),
  createKeystore: vi.fn(), saveKeystore: vi.fn(), saveWords: vi.fn(), unlock: vi.fn(),
}));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  isValidMnemonic: (m: string) => m.split(' ').length === 12,
  loadKeystore: () => impl.load(),
  requestPersistence: () => Promise.resolve(true),
  createKeystore: impl.createKeystore, saveKeystore: impl.saveKeystore, saveWords: impl.saveWords, unlock: impl.unlock,
}));
vi.mock('../faceid', () => ({ faceIdSupported: () => Promise.resolve(false), enrolFaceId: vi.fn(), forgetFaceId: vi.fn(() => Promise.resolve(true)), hasFaceId: () => Promise.resolve(false), unlockWithFaceId: vi.fn() }));

const renderImport = () => render(
  <MemoryRouter initialEntries={['/i-wallet/import']}>
    <IWalletProvider store={{} as KvStore}>
      <Routes><Route path="i-wallet" element={<IWalletShell />}><Route index element={<p>home</p>} /><Route path="import" element={<Import />} /></Route></Routes>
    </IWalletProvider>
  </MemoryRouter>,
);

describe('i-Wallet import', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    impl.load = () => Promise.resolve(null);
    [impl.createKeystore, impl.saveKeystore, impl.saveWords, impl.unlock].forEach((f) => f.mockReset());
    impl.createKeystore.mockResolvedValue({ address: 'a', json: { address: 'a' } });
    impl.saveKeystore.mockResolvedValue(true);
    impl.saveWords.mockResolvedValue(true);
    impl.unlock.mockResolvedValue({ lock: vi.fn() });
  });

  it('rejects 11 words and stays on the words step', async () => {
    const u = user;
    renderImport();
    const box = await screen.findByLabelText('12 kelime');
    expect(box).toHaveAttribute('autocomplete', 'off');
    expect(box).toHaveAttribute('autocapitalize', 'none');
    expect(box).toHaveAttribute('spellcheck', 'false');
    await u.type(box, WORDS.split(' ').slice(0, 11).join(' '));
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    expect(screen.getByRole('alert')).toHaveTextContent('geçerli bir 12 kelimelik yedek değil');
    expect(screen.queryByLabelText('Parola')).toBeNull();
  });

  it('asks for a confirmation before replacing an existing wallet', async () => {
    impl.load = () => Promise.resolve({ address: 'old' });
    const u = user;
    renderImport();
    await u.type(await screen.findByLabelText('12 kelime'), WORDS);
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı aç' }));
    expect(impl.saveKeystore).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(impl.saveKeystore).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Cüzdanı aç' }));
    await u.click(screen.getByRole('button', { name: 'Evet, değiştir' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(impl.saveKeystore).toHaveBeenCalled();
  });
});

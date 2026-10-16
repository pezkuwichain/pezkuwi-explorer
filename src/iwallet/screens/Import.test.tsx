import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { user } from '../test-user';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell from '../IWalletRoutes';
import Import from './Import';
import type { KvStore } from '../idb';

// Valid BIP-39 phrases (the real validator runs): the standard test vectors.
const WORDS = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const WORDS24 = `${'abandon '.repeat(23)}art`;
const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve(null),
  createKeystore: vi.fn(), saveWalletAtomic: vi.fn(), unlock: vi.fn(),
}));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  loadKeystore: () => impl.load(),
  requestPersistence: () => Promise.resolve(true),
  createKeystore: impl.createKeystore, saveWalletAtomic: impl.saveWalletAtomic, unlock: impl.unlock,
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
    [impl.createKeystore, impl.saveWalletAtomic, impl.unlock].forEach((f) => f.mockReset());
    impl.createKeystore.mockResolvedValue({ address: 'a', json: { address: 'a' } });
    impl.saveWalletAtomic.mockResolvedValue(true);
    impl.unlock.mockResolvedValue({ lock: vi.fn() });
  });

  it('rejects 11 words and stays on the words step', async () => {
    const u = user;
    renderImport();
    const box = await screen.findByLabelText('12 veya 24 kelime');
    expect(box).toHaveAttribute('autocomplete', 'off');
    expect(box).toHaveAttribute('autocapitalize', 'none');
    expect(box).toHaveAttribute('spellcheck', 'false');
    await u.type(box, WORDS.split(' ').slice(0, 11).join(' '));
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    expect(screen.getByRole('alert')).toHaveTextContent('geçerli bir 12 veya 24 kelimelik yedek değil');
    expect(screen.queryByLabelText('Parola')).toBeNull();
  });

  it('asks for a confirmation before replacing an existing wallet', async () => {
    impl.load = () => Promise.resolve({ address: 'old' });
    const u = user;
    renderImport();
    await u.type(await screen.findByLabelText('12 veya 24 kelime'), WORDS);
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı aç' }));
    expect(impl.saveWalletAtomic).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(impl.saveWalletAtomic).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Cüzdanı aç' }));
    await u.click(screen.getByRole('button', { name: 'Evet, değiştir' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(impl.saveWalletAtomic).toHaveBeenCalled();
  });

  it('accepts a valid 24-word phrase with the real validator and saves it', async () => {
    const u = user;
    renderImport();
    await u.type(await screen.findByLabelText('12 veya 24 kelime'), WORDS24);
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı aç' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(impl.saveWalletAtomic).toHaveBeenCalledWith({ address: 'a' }, WORDS24, 'longenough1', false);
  });

  it('Back from the password step clears the words and asks for them again', async () => {
    const u = user;
    renderImport();
    await u.type(await screen.findByLabelText('12 veya 24 kelime'), WORDS);
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    await u.click(screen.getByRole('button', { name: 'Geri' }));
    expect(screen.getByLabelText('12 veya 24 kelime')).toHaveValue('');
  });

  it('keeps the old wallet when the atomic save fails', async () => {
    impl.load = () => Promise.resolve({ address: 'old' });
    impl.saveWalletAtomic.mockResolvedValue(false);
    const u = user;
    renderImport();
    await u.type(await screen.findByLabelText('12 veya 24 kelime'), WORDS);
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı aç' }));
    await u.click(screen.getByRole('button', { name: 'Evet, değiştir' }));
    expect(await screen.findByText(/KAYDEDİLEMEDİ/)).toBeInTheDocument();
    expect(impl.unlock).not.toHaveBeenCalled();
  });
});

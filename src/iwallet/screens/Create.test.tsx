import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { user } from '../test-user';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import Create from './Create';
import type { KvStore } from '../idb';

const WORDS = 'orbit fabric lunar vessel harbor candle meadow tribe glance salute oyster wisdom';
const k = vi.hoisted(() => ({
  saveKeystore: vi.fn(), saveWords: vi.fn(), deleteKeystore: vi.fn(), createKeystore: vi.fn(), unlock: vi.fn(),
}));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  newMnemonic: () => 'orbit fabric lunar vessel harbor candle meadow tribe glance salute oyster wisdom',
  loadKeystore: () => Promise.resolve(null),
  requestPersistence: () => Promise.resolve(true),
  createKeystore: k.createKeystore, saveKeystore: k.saveKeystore, saveWords: k.saveWords, deleteKeystore: k.deleteKeystore, unlock: k.unlock,
}));
vi.mock('../faceid', () => ({ faceIdSupported: () => Promise.resolve(false), enrolFaceId: vi.fn(), forgetFaceId: vi.fn(), hasFaceId: () => Promise.resolve(false), unlockWithFaceId: vi.fn() }));

const renderCreate = () => render(
  <MemoryRouter initialEntries={['/i-wallet/create']}>
    <IWalletProvider store={{} as KvStore}>
      <Routes>
        <Route path="i-wallet" element={<IWalletShell />}>
          <Route index element={<IWalletIndex />} />
          <Route path="create" element={<Create />} />
        </Route>
      </Routes>
    </IWalletProvider>
  </MemoryRouter>,
);

// Walks steps 1 and 2 with the right answers.
async function toPasswordStep() {
  const u = user;
  await u.click(await screen.findByRole('checkbox'));
  await u.click(screen.getByRole('button', { name: 'Devam' }));
  const w = WORDS.split(' ');
  for (const i of [2, 6, 10]) {
    await u.click(within3(i, w[i]));
  }
  await u.click(screen.getByRole('button', { name: 'Doğrula' }));
  return u;
}
const within3 = (index: number, word: string) => {
  const group = screen.getByRole('group', { name: `${index + 1}. kelime` });
  return Array.from(group.querySelectorAll('button')).find((b) => b.textContent === word) as HTMLButtonElement;
};

describe('i-Wallet create', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    Object.values(k).forEach((f) => f.mockReset());
    k.createKeystore.mockResolvedValue({ address: 'a', json: { address: 'a' } });
    k.saveKeystore.mockResolvedValue(true);
    k.saveWords.mockResolvedValue(true);
    k.deleteKeystore.mockResolvedValue(undefined);
    k.unlock.mockResolvedValue({ lock: vi.fn() });
  });

  it('keeps Devam disabled until the paper checkbox is ticked', async () => {
    renderCreate();
    const next = await screen.findByRole('button', { name: 'Devam' });
    expect(next).toBeDisabled();
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    await user.click(screen.getByRole('checkbox'));
    expect(next).toBeEnabled();
  });

  it('blocks a wrong quiz word, shows the error and lets the user change the pick', async () => {
    const u = user;
    renderCreate();
    await u.click(await screen.findByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Devam' }));
    const w = WORDS.split(' ');
    for (const i of [6, 10]) await u.click(within3(i, w[i]));
    const group = screen.getByRole('group', { name: '3. kelime' });
    const wrongBtn = Array.from(group.querySelectorAll('button')).find((b) => b.textContent !== w[2]) as HTMLButtonElement;
    await u.click(wrongBtn);
    expect(screen.getByText('Yanlış kelime, tekrar dene.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Doğrula' })).toBeDisabled();
    await u.click(within3(2, w[2]));
    expect(screen.queryByText('Yanlış kelime, tekrar dene.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Doğrula' })).toBeEnabled();
  });

  it('blocks Create for a short password or a mismatch', async () => {
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    const create = screen.getByRole('button', { name: 'Cüzdanı oluştur' });
    await u.type(pw, 'short'); await u.type(again, 'short');
    expect(create).toBeDisabled();
    await u.clear(pw); await u.clear(again);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough2');
    expect(screen.getByText('Parolalar aynı değil.')).toBeInTheDocument();
    expect(create).toBeDisabled();
    expect(k.createKeystore).not.toHaveBeenCalled();
  });

  it('shows the not-saved error, stays on step 3 and removes a half-saved keystore', async () => {
    k.saveWords.mockResolvedValue(false);
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('KAYDEDİLEMEDİ');
    expect(k.deleteKeystore).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cüzdanı oluştur' })).toBeInTheDocument();
  });

  it('creates the wallet and leaves for the wallet screen', async () => {
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: "i-Wallet'iniz" })).toBeInTheDocument());
    expect(k.saveKeystore).toHaveBeenCalled();
    expect(k.saveWords).toHaveBeenCalledWith(WORDS, 'longenough1');
  });
});

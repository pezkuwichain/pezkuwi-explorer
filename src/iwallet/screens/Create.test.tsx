import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { user } from '../test-user';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { IWalletProvider, useIWallet } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import Create from './Create';
import type { KvStore } from '../idb';

const WORDS = 'orbit fabric lunar vessel harbor candle meadow tribe glance salute oyster wisdom';
const k = vi.hoisted(() => ({
  storeWalletAtomic: vi.fn(), createKeystore: vi.fn(), unlock: vi.fn(), load: (): Promise<unknown> => Promise.resolve(null),
  faceSupported: false, enrol: vi.fn(),
}));
vi.mock('../keystore', async (orig) => ({
  ...(await orig<typeof import('../keystore')>()),
  newMnemonic: () => 'orbit fabric lunar vessel harbor candle meadow tribe glance salute oyster wisdom',
  loadKeystore: () => k.load(),
  requestPersistence: () => Promise.resolve(true),
  createKeystore: k.createKeystore, storeWalletAtomic: k.storeWalletAtomic, unlock: k.unlock,
  // Sealing is the scrypt step; the test sees what it was given in what gets stored.
  sealWords: (m: string, pw: string) => Promise.resolve({ sealed: m, pw }),
}));
vi.mock('../faceid', () => ({ faceIdSupported: () => Promise.resolve(k.faceSupported), enrolFaceId: (pw: string) => k.enrol(pw), hasFaceId: () => Promise.resolve(false), unlockWithFaceId: vi.fn() }));

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
    [k.storeWalletAtomic, k.createKeystore, k.unlock, k.enrol].forEach((f) => f.mockReset());
    k.load = () => Promise.resolve(null); k.faceSupported = false;
    k.createKeystore.mockResolvedValue({ address: 'a', json: { address: 'a' } });
    k.storeWalletAtomic.mockResolvedValue(true);
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

  it('takes the words off the screen while the page is hidden (app switcher snapshot) and shows them again on return', async () => {
    renderCreate();
    await screen.findByRole('button', { name: 'Devam' });
    const setHidden = (v: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    };
    setHidden(true);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    setHidden(false);
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
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

  it('says at the password step, under the create button, that continuing accepts the terms and privacy notice, in a new tab', async () => {
    renderCreate();
    await toPasswordStep();
    const line = (await screen.findByText(/Devam ederek/)).closest('p')!;
    expect(line.querySelector('a[href="/terms"]')).toHaveTextContent('Kullanım koşullarını');
    expect(line.querySelector('a[href="/privacy"]')).toHaveTextContent('Gizlilik bildirimini');
    // The new words live only in this screen: the pages open in a new tab, never in place of it.
    for (const a of line.querySelectorAll('a')) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const submit = screen.getByRole('button', { name: 'Cüzdanı oluştur' });
    expect(submit.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('shows the not-saved error and stays on step 3 when the atomic save fails', async () => {
    k.storeWalletAtomic.mockResolvedValue(false);
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('KAYDEDİLEMEDİ');
    expect(k.unlock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cüzdanı oluştur' })).toBeInTheDocument();
  });

  it('creates the wallet, saves keystore and words together, and leaves the words out of the page', async () => {
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: "i-Wallet'in" })).toBeInTheDocument());
    expect(k.storeWalletAtomic).toHaveBeenCalledWith({ address: 'a' }, { sealed: WORDS, pw: 'longenough1' }, false);
    expect(document.body.textContent).not.toContain('orbit');
  });

  it('says the wallet is being saved while the key is sealed', async () => {
    let done: () => void = () => undefined;
    k.createKeystore.mockReturnValueOnce(new Promise((r) => { done = () => r({ address: 'a', json: { address: 'a' } }); }));
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    expect(await screen.findByText('Cüzdanın kaydediliyor…', { selector: '.progress-message' })).toBeInTheDocument();
    await act(async () => { done(); });
    await waitFor(() => expect(screen.getByRole('heading', { name: "i-Wallet'in" })).toBeInTheDocument());
    expect(document.querySelector('.progress-overlay')).toBeNull();
  });

  it('redirects to the wallet and never creates when a wallet already exists', async () => {
    k.load = () => Promise.resolve({ address: 'old' });
    renderCreate();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'i-Wallet kilitli' })).toBeInTheDocument());
    expect(k.createKeystore).not.toHaveBeenCalled();
    expect(k.storeWalletAtomic).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('enrols Face ID only from its own tap after the wallet exists, then drops the password', async () => {
    k.faceSupported = true;
    k.enrol.mockResolvedValue({ ok: true });
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(await screen.findByRole('switch'));
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    const enable = await screen.findByRole('button', { name: "Face ID'yi aç" });
    expect(k.enrol).not.toHaveBeenCalled();
    await u.click(enable);
    expect(k.enrol).toHaveBeenCalledWith('longenough1');
    expect(await screen.findByText('Face ID açık.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Face ID'yi aç" })).toBeNull();
  });

  it('keeps the wallet and allows a retry when the Face ID prompt is cancelled', async () => {
    k.faceSupported = true;
    k.enrol.mockResolvedValue({ ok: false, reason: 'cancelled' });
    renderCreate();
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(await screen.findByRole('switch'));
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    await u.click(await screen.findByRole('button', { name: "Face ID'yi aç" }));
    expect(await screen.findByText(/Ayarlar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Face ID'yi aç" })).toBeEnabled();
  });

  it('drops the setup password when the wallet locks: no Enable button, no enrolment', async () => {
    k.faceSupported = true;
    let lockFn: () => void = () => undefined;
    const Grab = () => { const { lock } = useIWallet(); useEffect(() => { lockFn = lock; }, [lock]); return null; };
    render(
      <MemoryRouter initialEntries={['/i-wallet/create']}>
        <IWalletProvider store={{} as KvStore}>
          <Grab />
          <Routes><Route path="i-wallet" element={<IWalletShell />}><Route index element={<IWalletIndex />} /><Route path="create" element={<Create />} /></Route></Routes>
        </IWalletProvider>
      </MemoryRouter>,
    );
    const u = await toPasswordStep();
    const [pw, again] = screen.getAllByLabelText(/Parola/);
    await u.type(pw, 'longenough1'); await u.type(again, 'longenough1');
    await u.click(await screen.findByRole('switch'));
    await u.click(screen.getByRole('button', { name: 'Cüzdanı oluştur' }));
    expect(await screen.findByRole('button', { name: "Face ID'yi aç" })).toBeInTheDocument();
    await act(async () => { lockFn(); });
    expect(screen.queryByRole('button', { name: "Face ID'yi aç" })).toBeNull();
    expect(k.enrol).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cüzdana git' })).toBeInTheDocument();
  });
});

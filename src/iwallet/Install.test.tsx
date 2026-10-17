import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { user } from './test-user';
import i18n from '../i18n';
import { IWalletProvider } from './IWalletContext';
import { resetInstallForTests, startInstallCapture } from '../ui/install';
import Home from './screens/Home';
import Landing from './screens/Landing';
import type { KvStore } from './idb';

vi.mock('./data', () => ({ loadWalletHoldings: () => new Promise(() => undefined), loadAssetHoldings: () => new Promise(() => undefined) }));

const ADDR = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const TELEGRAM_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/11.2';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';

const setUa = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const setStandalone = (on: boolean) => { window.matchMedia = ((q: string) => ({ matches: on && q.includes('standalone') })) as never; };
const fakeInstallEvent = () => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(e, { prompt: vi.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
};
const fire = (e: Event) => act(() => { window.dispatchEvent(e); });

const renderHome = () => render(<MemoryRouter><Home address={ADDR} /></MemoryRouter>);
// An empty store: no keystore, so the provider settles on state 'none' (the Landing with create / import).
const emptyStore = (): KvStore => ({
  get: () => Promise.resolve(undefined), set: () => Promise.resolve(), delete: () => Promise.resolve(),
  deleteMany: () => Promise.resolve(), setMany: () => Promise.resolve(),
});
const renderLanding = () => render(<MemoryRouter><IWalletProvider store={emptyStore()}><Landing /></IWalletProvider></MemoryRouter>);
const button = () => screen.queryByRole('button', { name: 'Ana Ekrana ekle' });

describe('Add to Home Screen', () => {
  const realUa = navigator.userAgent;
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    resetInstallForTests(); startInstallCapture();
    setStandalone(false); setUa(FIREFOX);
  });
  afterEach(() => { resetInstallForTests(); setUa(realUa); document.documentElement.classList.remove('in-wallet'); });

  it('Chromium: shows the button once the browser offers an install, prompts with it, and hides it after install', async () => {
    renderHome();
    expect(screen.getByText(/Tarayıcı verisi silinirse/)).toBeInTheDocument();
    expect(button()).toBeNull();
    const e = fakeInstallEvent();
    await fire(e);
    expect(e.defaultPrevented).toBe(true);
    await user.click(button()!);
    expect(e.prompt).toHaveBeenCalledTimes(1);
    // A second offer (after a dismissal Chromium sends a new one), then the app is installed: no button.
    await fire(fakeInstallEvent());
    expect(button()).not.toBeNull();
    await fire(new Event('appinstalled'));
    expect(button()).toBeNull();
    expect(screen.getByText(/Tarayıcı verisi silinirse/)).toBeInTheDocument();
  });

  it('iOS: the button opens the three Safari steps and the storage note with the restore link', async () => {
    setUa(IPHONE);
    renderHome();
    await user.click(button()!);
    const dialog = await screen.findByRole('dialog', { name: "i-Wallet'i Ana Ekrana ekle" });
    const steps = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toEqual([
      '1Tarayıcının araç çubuğundaki Paylaş düğmesine dokun', '2“Ana Ekrana Ekle”yi seç', '3“Ekle”ye dokun',
    ]);
    expect(within(dialog).getByText(/Ana Ekrandaki uygulama Safari'den ayrı, kendi deposunu kullanır/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '12 kelimeyle geri yükle' })).toHaveAttribute('href', '/i-wallet/import');
    expect(dialog.querySelectorAll('svg')).not.toHaveLength(0);
  });

  it('another browser without an install API keeps only the hint text', () => {
    renderHome();
    expect(screen.getByText(/Tarayıcı verisi silinirse/)).toBeInTheDocument();
    expect(button()).toBeNull();
  });

  it('standalone (opened from the Home Screen) shows neither the hint nor the button, even on iOS', async () => {
    setStandalone(true); setUa(IPHONE);
    renderHome();
    await fire(fakeInstallEvent());
    expect(screen.queryByText(/Tarayıcı verisi silinirse/)).toBeNull();
    expect(button()).toBeNull();
  });

  it('Landing: the "add first" card before create/import on iOS', () => {
    setUa(IPHONE);
    renderLanding();
    const card = screen.getByRole('region', { name: 'Ana Ekrana ekle' });
    expect(card).toHaveTextContent("Önce i-Wallet'i Ana Ekrana ekle, cüzdanını orada oluştur");
    expect(within(card).getByRole('button', { name: 'Ana Ekrana ekle' })).toBeInTheDocument();
    const create = screen.getByRole('link', { name: "i-Wallet'ini al" });
    expect(card.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Landing: on Chromium only while an install can be prompted, with the quick-access line; never elsewhere or standalone', async () => {
    const first = renderLanding();
    expect(await screen.findByRole('link', { name: "i-Wallet'ini al" })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ana Ekrana ekle' })).toBeNull();
    await fire(fakeInstallEvent());
    const card = screen.getByRole('region', { name: 'Ana Ekrana ekle' });
    // Android's installed app shares Chrome's storage: no "create your wallet there".
    expect(card).toHaveTextContent("Hızlı erişim için i-Wallet'i Ana Ekrana ekle");
    expect(card).not.toHaveTextContent('orada oluştur');
    first.unmount();
    setStandalone(true); setUa(IPHONE);
    renderLanding();
    // The state has settled on 'none' (the hero is there), so only the standalone check can hide the card.
    expect(await screen.findByRole('link', { name: "i-Wallet'ini al" })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ana Ekrana ekle' })).toBeNull();
  });

  it('in-app browsers on iOS (Telegram, the Pezkuwi Wallet DApp browser) keep only the hint: no steps, no card', async () => {
    setUa(TELEGRAM_IPHONE);
    const first = renderHome();
    expect(screen.getByText(/Tarayıcı verisi silinirse/)).toBeInTheDocument();
    expect(button()).toBeNull();
    first.unmount();
    renderLanding();
    expect(await screen.findByRole('link', { name: "i-Wallet'ini al" })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ana Ekrana ekle' })).toBeNull();
  });

  it('hides the iOS button once the page turns out to be inside the Pezkuwi Wallet (html.in-wallet set after load)', async () => {
    setUa(IPHONE);
    renderHome();
    expect(button()).not.toBeNull();
    await act(async () => { document.documentElement.classList.add('in-wallet'); await Promise.resolve(); });
    expect(button()).toBeNull();
    expect(screen.getByText(/Tarayıcı verisi silinirse/)).toBeInTheDocument();
  });
});

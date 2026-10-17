import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import i18n from './i18n';
import App from './App';
import * as keystore from './iwallet/keystore';

vi.mock('./data/network', () => ({ loadLiveness: () => Promise.resolve(true), loadNetwork: () => Promise.resolve({ live: true, validators: 1, votes: [], treasury: 0n }) }));
vi.mock('./data/citizenship', () => ({ loadCitizenship: () => Promise.resolve({ stage: 'approved', roles: [], trust: 0n }) }));

// Every Home button target must resolve to a screen (no empty outlet).
describe('App routes', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  it.each(['/account', '/payment', '/citizenship', '/network'])('%s resolves to a screen', async (path) => {
    window.history.pushState({}, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });
  it.each([['/privacy', 'Privacy'], ['/terms', 'Terms of use']])('%s renders inside the layout, with the tab bar and the footer', async (path, title) => {
    const spy = vi.spyOn(keystore, 'loadKeystore');
    window.history.pushState({}, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'privacy@pezkuwichain.io' })[0]).toHaveAttribute('href', 'mailto:privacy@pezkuwichain.io');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('never reads the wallet store on a non-wallet route', async () => {
    const spy = vi.spyOn(keystore, 'loadKeystore');
    window.history.pushState({}, '', '/');
    render(<App />);
    // The tab bar (the footer has its own, named navigation too).
    await screen.findByRole('navigation', { name: 'Sections' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('reads it on /i-wallet', async () => {
    const spy = vi.spyOn(keystore, 'loadKeystore').mockResolvedValue(null);
    window.history.pushState({}, '', '/i-wallet');
    render(<App />);
    // The i-Wallet loads on demand: its landing arrives, and the store is read once.
    expect(await screen.findByRole('link', { name: 'Get an i-Wallet' }, { timeout: 5000 })).toHaveAttribute('href', '/i-wallet/create');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    spy.mockRestore();
  });
});

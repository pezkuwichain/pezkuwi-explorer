import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('never reads the wallet store on a non-wallet route', async () => {
    const spy = vi.spyOn(keystore, 'loadKeystore');
    window.history.pushState({}, '', '/');
    render(<App />);
    await screen.findByRole('navigation');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('reads it on /i-wallet', async () => {
    const spy = vi.spyOn(keystore, 'loadKeystore').mockResolvedValue(null);
    window.history.pushState({}, '', '/i-wallet');
    render(<App />);
    await screen.findByRole('link', { name: /i-Wallet/ });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

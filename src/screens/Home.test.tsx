import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import Home from './Home';

const full = vi.fn();
// The home light reads only the relay; the full overview (three chains) must not gate it.
vi.mock('../data/network', () => ({ loadLiveness: () => Promise.resolve(true), loadNetwork: () => full() }));

describe('Home', () => {
  it('shows the four big buttons with links', async () => {
    await i18n.changeLanguage('en');
    render(<MemoryRouter><AccountProvider><Home /></AccountProvider></MemoryRouter>);
    for (const [label, href] of [['My account', '/account'], ['Did my payment arrive?', '/payment'], ['Citizenship', '/citizenship'], ['Network', '/network']]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(await screen.findByText('The network is working')).toBeInTheDocument();
    expect(full).not.toHaveBeenCalled();
  });
});

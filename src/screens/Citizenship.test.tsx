import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import Citizenship from './Citizenship';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve({ stage: 'approved', roles: ['Welati'], trust: 12n }),
  calls: 0,
}));
vi.mock('../data/citizenship', () => ({ loadCitizenship: () => { impl.calls++; return impl.load(); } }));

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }
const renderIt = () => render(
  <MemoryRouter initialEntries={['/citizenship']}><AccountProvider>
    <Routes><Route path="citizenship" element={<Citizenship />} /><Route path="*" element={<Where />} /></Routes>
  </AccountProvider></MemoryRouter>);

describe('Citizenship', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en'); storage.set('account', ALICE); impl.calls = 0;
    impl.load = () => Promise.resolve({ stage: 'approved', roles: ['Welati'], trust: 12n });
  });

  it('marks the current step and shows roles and trust', async () => {
    renderIt();
    expect(await screen.findByText('Approved')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('an unknown role variant renders its raw name', async () => {
    impl.load = () => Promise.resolve({ stage: 'citizen', roles: ['BrandNewRole'], trust: 1n });
    renderIt();
    expect(await screen.findByText('BrandNewRole')).toBeInTheDocument();
    expect(screen.queryByText(/tiki\./)).toBeNull();
  });

  it('notStarted shows its message and no steps', async () => {
    impl.load = () => Promise.resolve({ stage: 'notStarted', roles: [], trust: 0n });
    renderIt();
    expect(await screen.findByText('No application yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Applied')).toBeNull();
    expect(screen.getByText('No roles yet.')).toBeInTheDocument();
  });

  it('revoked shows its message', async () => {
    impl.load = () => Promise.resolve({ stage: 'revoked', roles: [], trust: 0n });
    renderIt();
    expect(await screen.findByText('Citizenship was revoked')).toBeInTheDocument();
  });

  it('localises trust digits and keeps them in bdi', async () => {
    await i18n.changeLanguage('ckb');
    impl.load = () => Promise.resolve({ stage: 'citizen', roles: [], trust: 12345678901234567890n });
    renderIt();
    const bdi = await screen.findByText(/١/);
    expect(bdi.tagName).toBe('BDI');
    expect(bdi.textContent).not.toMatch(/[0-9]/);
  });

  it('no open account redirects to open with next and loads nothing', async () => {
    storage.remove('account');
    renderIt();
    expect(await screen.findByTestId('where')).toHaveTextContent('/account/open?next=/citizenship');
    expect(impl.calls).toBe(0);
  });
});

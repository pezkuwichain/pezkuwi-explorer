import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setLanguage } from '../i18n';
import '../i18n';
import Layout, { Addr } from './Layout';
import PageHeader from './PageHeader';

describe('Layout', () => {
  it('flips the document to RTL for Sorani and keeps addresses LTR', () => {
    setLanguage('ckb');
    expect(document.documentElement.dir).toBe('rtl');
    render(<MemoryRouter><Addr value="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" /></MemoryRouter>);
    const el = screen.getByText('5Grwva…GKutQY');
    expect(el.tagName).toBe('BDI');
    expect(el).toHaveAttribute('dir', 'ltr');
    setLanguage('kmr');
  });

  it('back button falls back to home when there is no in-app history',  () => {
    setLanguage('en');
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>HOME</p>} />
            <Route path="x" element={<><PageHeader title="Deep" /><p>DEEP</p></>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('DEEP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByText('HOME')).toBeInTheDocument();
    setLanguage('kmr');
  });

  it('shows the four tabs on every screen and marks the current one', () => {
    setLanguage('en');
    for (const [path, current] of [['/', 'Home'], ['/account', 'Account'], ['/account/open', 'Account'], ['/citizenship', 'Citizenship'], ['/network', 'Network'], ['/payment', null]] as const) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}><Routes><Route element={<Layout />}><Route path="*" element={<p>SCREEN</p>} /></Route></Routes></MemoryRouter>,
      );
      const tabs = screen.getByRole('navigation', { name: 'Sections' });
      const links = within(tabs).getAllByRole('link');
      expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/account', '/citizenship', '/network']);
      const active = links.filter((l) => l.getAttribute('aria-current') === 'page');
      expect(active.map((l) => l.textContent)).toEqual(current ? [current] : []);
      unmount();
    }
    setLanguage('kmr');
  });

  it('the language pill shows the code and keeps the native picker', () => {
    setLanguage('kmr');
    render(<MemoryRouter initialEntries={['/']}><Routes><Route element={<Layout />}><Route index element={<p>HOME</p>} /></Route></Routes></MemoryRouter>);
    expect(screen.getByText('KMR')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Ziman' });
    fireEvent.change(select, { target: { value: 'en' } });
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByText('EN')).toBeInTheDocument();
    setLanguage('kmr');
  });

  it('inner screens keep the language picker in their header', () => {
    setLanguage('en');
    render(<MemoryRouter><PageHeader title="Deep" /></MemoryRouter>);
    expect(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    setLanguage('kmr');
  });

  it('isolates the footer domain as left-to-right in every locale', () => {
    for (const lang of ['kmr', 'ckb', 'tr', 'en', 'fa', 'ar'] as const) {
      setLanguage(lang);
      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}><Routes><Route element={<Layout />}><Route index element={<p>HOME</p>} /></Route></Routes></MemoryRouter>,
      );
      const link = document.querySelector('footer a') as HTMLElement;
      expect(link).toHaveAttribute('href', 'https://apps.pezkuwichain.io');
      const domain = link.querySelector('bdi');
      expect(domain).not.toBeNull();
      expect(domain).toHaveAttribute('dir', 'ltr');
      expect(domain).toHaveTextContent(/^apps\.pezkuwichain\.io$/);
      unmount();
    }
    setLanguage('kmr');
  });
});

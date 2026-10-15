import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setLanguage } from '../i18n';
import '../i18n';
import Layout, { Addr } from './Layout';

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
            <Route path="x" element={<p>DEEP</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('DEEP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByText('HOME')).toBeInTheDocument();
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

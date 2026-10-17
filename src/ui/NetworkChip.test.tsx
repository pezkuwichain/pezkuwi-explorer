import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '../i18n';
import PageHeader from './PageHeader';
import { NETWORK_ID } from '../config/network';

// A page that reads Zagros (chosen before any import resolves NETWORK).
vi.hoisted(() => localStorage.setItem('pezkuwi-explorer:network', 'zagros'));

describe('network chip on a Zagros page', () => {
  it('reads as the testnet, in the warning colours, in every locale', () => {
    expect(NETWORK_ID).toBe('zagros');
    const labels = { en: 'Testnet (Zagros)', tr: 'Test ağı (Zagros)', kmr: 'Tora ceribandinê (Zagros)' } as const;
    for (const [lang, label] of Object.entries(labels)) {
      setLanguage(lang as keyof typeof labels);
      const r = render(<MemoryRouter initialEntries={['/account']}><PageHeader title="Deep" /></MemoryRouter>);
      expect(screen.getByText(label)).toHaveClass('net-chip', 'net-chip-zagros');
      r.unmount();
    }
    setLanguage('kmr');
  });
});

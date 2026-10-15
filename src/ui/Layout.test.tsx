import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '../i18n';
import { Addr } from './Layout';

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
});

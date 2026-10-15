import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '../i18n';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
const Bomb = () => { if (shouldThrow) throw new RangeError('boom'); return <p>fine</p>; };

describe('ErrorBoundary', () => {
  it('shows the localised error instead of crashing, and retry recovers', async () => {
    await i18n.changeLanguage('en');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText(/This could not be loaded/)).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('fine')).toBeInTheDocument();
    spy.mockRestore();
  });
});

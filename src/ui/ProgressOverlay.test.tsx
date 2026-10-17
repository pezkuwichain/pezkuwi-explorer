import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import { ProgressOverlay } from './ProgressOverlay';

describe('ProgressOverlay', () => {
  it('is a polite status with the sun and the message, and takes focus', () => {
    render(<ProgressOverlay message="Opening…" />);
    const s = screen.getByRole('status');
    expect(s).toHaveAttribute('aria-live', 'polite');
    expect(s).toHaveTextContent('Opening…');
    expect(s).toHaveFocus();
    expect(s.querySelectorAll('.ks-ray')).toHaveLength(21);
  });

  it('keeps the sun still for reduced motion, and has no inline <style> (CSP style-src self)', () => {
    const css = readFileSync('src/ui/KurdistanSun.css', 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation: none/);
    render(<ProgressOverlay message="x" />);
    expect(document.querySelector('style')).toBeNull();
  });

  it('makes inert what is added to <body> while it shows, restoring it on close', async () => {
    const view = render(<ProgressOverlay message="x" />);
    // Isolation comes from inert, not aria-modal (which is not allowed on role="status").
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-modal');
    const late = document.createElement('div');
    document.body.appendChild(late);
    await waitFor(() => expect(late).toHaveAttribute('inert'));
    expect(late).toHaveAttribute('aria-hidden', 'true');
    view.unmount();
    expect(late).not.toHaveAttribute('inert');
    expect(late).not.toHaveAttribute('aria-hidden');
    // Nothing is watched after close.
    const after = document.createElement('div');
    document.body.appendChild(after);
    await Promise.resolve();
    expect(after).not.toHaveAttribute('inert');
    late.remove(); after.remove();
  });
});

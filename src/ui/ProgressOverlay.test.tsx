import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
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
});

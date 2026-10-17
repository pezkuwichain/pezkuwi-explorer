import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('announces a new message in place, in the same card', () => {
    const view = render(<ProgressOverlay message="Signing…" />);
    const card = screen.getByRole('status');
    view.rerender(<ProgressOverlay message="Sending to the network…" />);
    expect(screen.getByRole('status')).toBe(card);
    expect(card).toHaveTextContent('Sending to the network…');
  });

  it('Escape dismisses only when a dismiss is offered; its button only when ready, and Tab stays in the card', () => {
    const onDismiss = vi.fn();
    const view = render(<ProgressOverlay message="x" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
    view.rerender(<ProgressOverlay message="x" dismiss={{ label: 'Continue in background', ready: false, onDismiss }} />);
    expect(screen.queryByRole('button')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    view.rerender(<ProgressOverlay message="x" dismiss={{ label: 'Continue in background', ready: true, onDismiss }} />);
    const card = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Continue in background' });
    expect(card).toContainElement(button);
    card.focus();
    fireEvent.keyDown(card, { key: 'Tab' });
    expect(button).toHaveFocus();
    fireEvent.keyDown(button, { key: 'Tab' });
    expect(card).toHaveFocus();
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(2);
    view.unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

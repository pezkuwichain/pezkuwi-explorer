import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '../i18n';
import { ProgressOverlay } from '../ui/ProgressOverlay';
import { AuthConfirm } from './AuthConfirm';

vi.mock('./faceid', () => ({ unlockWithFaceId: () => Promise.resolve(null) }));

// The order a real wrong password takes: the overlay goes first (withKeyProgress's finally) while the screen is still
// busy, its fallback timer runs with the field still disabled, and only then does the screen re-enable and show the error.
type S = { overlay: boolean; busy: boolean; error: string | null };
function Harness({ overlay, busy, error }: S) {
  return (
    <main>
      <AuthConfirm summary={<p>summary</p>} busy={busy} error={error} face={false}
        onPassword={() => undefined} onFaceFailed={() => undefined} onBack={() => undefined} submitLabel="Sign" />
      {overlay && <ProgressOverlay message="Signing…" failed={() => true} />}
    </main>
  );
}

describe('AuthConfirm', () => {
  it('puts focus on the password field after a failure, even when the overlay left while the field was disabled', async () => {
    const { rerender } = render(<Harness overlay busy error={null} />);
    const field = document.querySelector<HTMLInputElement>('input[type="password"]')!;
    expect(field).toBeDisabled();
    rerender(<Harness overlay={false} busy error={null} />);
    await act(() => new Promise((r) => setTimeout(r, 10))); // the overlay's fallback timer has run
    expect(field).not.toHaveFocus();
    rerender(<Harness overlay={false} busy={false} error="Wrong password. Try again." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong password');
    expect(field).toHaveFocus();
  });

  it('does not move focus while there is no error', () => {
    const { rerender } = render(<Harness overlay busy error={null} />);
    rerender(<Harness overlay={false} busy={false} error={null} />);
    expect(document.querySelector('input[type="password"]')).not.toHaveFocus();
  });
});

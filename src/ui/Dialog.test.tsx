import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import i18n from '../i18n';
import { Dialog } from './Dialog';

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open it</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Title" description="Words"><button type="button">Inside</button></Dialog>
    </>
  );
}

describe('Dialog', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('opens as a modal with its title and description, and locks the page behind it', () => {
    render(<Opener />);
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }));
    const d = document.querySelector('dialog')!;
    expect(d.open).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Title' })).toHaveAccessibleDescription('Words');
    expect(document.documentElement).toHaveClass('dialog-open');
  });
  it('Escape closes it and focus goes back to the opener', async () => {
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    screen.getByRole('button', { name: 'Inside' }).focus();
    // The browser turns Escape into a cancel event on the open modal dialog.
    await act(async () => { document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })); });
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.documentElement).not.toHaveClass('dialog-open');
  });
  it('a tap on the backdrop closes it; a tap inside does not', () => {
    render(<Opener />);
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inside' }));
    expect(document.querySelector('dialog')).not.toBeNull();
    fireEvent.click(document.querySelector('dialog')!);
    expect(document.querySelector('dialog')).toBeNull();
  });
  it('the close button closes it', () => {
    render(<Opener />);
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog')).toBeNull();
  });
});

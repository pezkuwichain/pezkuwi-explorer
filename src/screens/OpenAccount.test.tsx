import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import OpenAccount from './OpenAccount';

const ui = () => render(
  <MemoryRouter initialEntries={['/account/open']}><AccountProvider><Routes>
    <Route path="/account/open" element={<OpenAccount />} />
    <Route path="/account" element={<p>ACCOUNT PAGE</p>} />
  </Routes></AccountProvider></MemoryRouter>);

describe('OpenAccount', () => {
  it('offers the three ways in', async () => {
    await i18n.changeLanguage('en'); ui();
    for (const n of ['Open with my wallet', 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
  });
  it('shows a plain error for an invalid paste and opens a valid one', async () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Paste address' }));
    const box = screen.getByPlaceholderText('Paste your address here');
    fireEvent.change(box, { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This is not a valid address');
    fireEvent.change(box, { target: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('ACCOUNT PAGE')).toBeInTheDocument();
  });
});

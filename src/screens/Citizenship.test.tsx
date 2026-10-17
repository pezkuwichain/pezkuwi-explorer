import { formatCitizenUid } from '../citizen/citizenUid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import Citizenship from './Citizenship';

// The card names the network it reads; these assertions were written for Zagros, so the page is pinned to it
// (stored before any import resolves NETWORK).
vi.hoisted(() => localStorage.setItem('pezkuwi-explorer:network', 'zagros'));

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve({ stage: 'approved', roles: ['Welati'], trust: 12n }),
  calls: 0,
  photo: null as null | (() => Promise<string>),
}));
vi.mock('../data/citizenship', () => ({ loadCitizenship: () => { impl.calls++; return impl.load(); } }));
// Decoding a picture needs a real browser; the screen only needs to know what the conversion returned.
vi.mock('../citizen/personal', async (orig) => {
  const m = await orig<typeof import('../citizen/personal')>();
  return { ...m, toPhotoDataUrl: (f: File) => (impl.photo ? impl.photo() : m.toPhotoDataUrl(f)) };
});

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }
const renderIt = () => render(
  <MemoryRouter initialEntries={['/citizenship']}><AccountProvider>
    <Routes><Route path="citizenship" element={<Citizenship />} /><Route path="*" element={<Where />} /></Routes>
  </AccountProvider></MemoryRouter>);
const front = () => document.querySelector('.cid-front') as HTMLElement;
const back = () => document.querySelector('.cid-back') as HTMLElement;
const steps = () => screen.getByRole('region', { name: 'Steps' });

describe('Citizenship', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en'); localStorage.clear(); storage.set('account', ALICE); impl.calls = 0; impl.photo = null;
    impl.load = () => Promise.resolve({ stage: 'approved', roles: ['Welati'], trust: 12n });
  });
  afterEach(() => vi.restoreAllMocks());

  it('marks the current step and shows role and trust on the card', async () => {
    renderIt();
    await screen.findByRole('region', { name: 'Steps' });
    expect(within(steps()).getByText('Approved')).toHaveAttribute('aria-current', 'step');
    expect(within(front()).getByText('12')).toBeInTheDocument();
    expect(within(front()).getByText('Citizen')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('front: shared citizen number on one line, verified chip; back: full address, network, status, QR and MRZ', async () => {
    impl.load = () => Promise.resolve({ stage: 'citizen', roles: ['Welati'], trust: 86n, nftId: 57n });
    renderIt();
    await waitFor(() => expect(front()).not.toBeNull());
    const numberRow = front().querySelector('.cid-number-row')!;
    expect(numberRow).toHaveTextContent(`Citizen no.${formatCitizenUid(ALICE, 57n)}`);
    expect(front().querySelector('.cid-chip')).toHaveTextContent('✓ Approved');
    expect(within(back()).getByText(ALICE)).toBeInTheDocument();
    expect(back()).toHaveTextContent('Testnet (Zagros)');
    expect(front().querySelector('.cid-net')).toHaveTextContent('PEZKUWICHAIN · ZAGROS');
    expect(back()).toHaveTextContent('ON-CHAIN · NFT 57');
    expect(back().querySelector('.cid-qr svg path')!.getAttribute('d')!.length).toBeGreaterThan(100);
    const mrz = [...back().querySelectorAll('.cid-mrz > div')].map((d) => d.textContent);
    expect(mrz).toEqual([`IDDKZ${formatCitizenUid(ALICE, 57n)!.replace(/[^0-9]/g, '')}`.padEnd(30, '<'), '5GRWVAEF5ZXB26FZ9RCQPDWS57CTER', 'WELATI<<<<<<<<<<<<<<<<<<<<<<<<']);
  });

  it('without an NFT the number place shows the stage, and only approved or citizen gets the verified chip', async () => {
    impl.load = () => Promise.resolve({ stage: 'applied', roles: [], trust: 1n, nftId: null });
    renderIt();
    await waitFor(() => expect(front()).not.toBeNull());
    expect(front().querySelector('.cid-number-row')).toHaveTextContent('Citizen no.Applied');
    expect(front().querySelector('.cid-chip')).toBeNull();
    expect(front()).not.toHaveTextContent('#42-');
  });

  it('the card is one button that flips it; the hidden face is hidden from screen readers too', async () => {
    renderIt();
    const flip = await screen.findByRole('button', { name: 'Show the back' });
    expect(front()).toHaveAttribute('aria-hidden', 'false');
    expect(back()).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(flip);
    expect(flip).toHaveAccessibleName('Show the front');
    expect(front()).toHaveAttribute('aria-hidden', 'true');
    expect(back()).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Tap for the front')).toBeInTheDocument();
  });

  it('a name and photo added here show on the card and are kept only in this browser; clear removes them', async () => {
    impl.photo = () => Promise.resolve('data:image/jpeg;base64,QUJD');
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a photo and name on this device' }));
    expect(screen.getByText('The photo and name stay on this device only; they are never sent anywhere.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Given name'), { target: { value: 'Rêber' } });
    fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'Çiyayî' } });
    fireEvent.change(screen.getByLabelText('Choose a photo'), { target: { files: [new File(['x'], 'me.png', { type: 'image/png' })] } });
    await screen.findByAltText('Your photo');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(front()).getByText('Rêber')).toBeInTheDocument();
    expect(within(front()).getByAltText('Your photo')).toHaveAttribute('src', 'data:image/jpeg;base64,QUJD');
    expect(back().querySelector('.cid-mrz')).toHaveTextContent('WELATI<<CIYAYI<<REBER');
    expect(JSON.parse(localStorage.getItem(`pezkuwi-explorer:citizen:${ALICE}`)!)).toEqual({ given: 'Rêber', surname: 'Çiyayî', photo: 'data:image/jpeg;base64,QUJD' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo and name on this device' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this device' }));
    expect(within(front()).queryByText('Rêber')).toBeNull();
    expect(localStorage.getItem(`pezkuwi-explorer:citizen:${ALICE}`)).toBeNull();
  });

  it('a file that is not a picture is refused with a plain message', async () => {
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a photo and name on this device' }));
    fireEvent.change(screen.getByLabelText('Choose a photo'), { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is not a picture.');
  });

  it('when the browser will not store them, the card still shows them and says they will not be kept', async () => {
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a photo and name on this device' }));
    // The wrapper's own refusal path (blocked localStorage) is covered in storage.test.ts and personal.test.ts.
    vi.spyOn(storage, 'set').mockReturnValue(false);
    fireEvent.change(screen.getByLabelText('Given name'), { target: { value: 'Rêber' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(front()).getByText('Rêber')).toBeInTheDocument();
    expect(screen.getByText(/This browser will not keep them/)).toBeInTheDocument();
  });

  it('an unknown role variant renders its raw name', async () => {
    impl.load = () => Promise.resolve({ stage: 'citizen', roles: ['BrandNewRole'], trust: 1n });
    renderIt();
    expect(await screen.findByText('BrandNewRole', { selector: '.badges li' })).toBeInTheDocument();
    expect(screen.queryByText(/tiki\./)).toBeNull();
  });

  it('notStarted shows its message and no steps', async () => {
    impl.load = () => Promise.resolve({ stage: 'notStarted', roles: [], trust: 0n });
    renderIt();
    await waitFor(() => expect(front()).not.toBeNull());
    expect(front()).toHaveTextContent('No application yet');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Applied')).toBeNull();
    expect(screen.getByText('No roles yet.')).toBeInTheDocument();
  });

  it('revoked shows its message', async () => {
    impl.load = () => Promise.resolve({ stage: 'revoked', roles: [], trust: 0n });
    renderIt();
    await waitFor(() => expect(front()).not.toBeNull());
    expect(front()).toHaveTextContent('Citizenship was revoked');
  });

  it('localises trust digits and keeps them in bdi', async () => {
    await i18n.changeLanguage('ckb');
    impl.load = () => Promise.resolve({ stage: 'citizen', roles: [], trust: 12345678901234567890n });
    renderIt();
    const bdi = await screen.findByText(/١/);
    expect(bdi.tagName).toBe('BDI');
    expect(bdi.textContent).not.toMatch(/[0-9]/);
  });

  it('a known role is translated', async () => {
    renderIt();
    expect(await screen.findByText('Citizen', { selector: '.badges li' })).toBeInTheDocument();
    expect(screen.queryByText('Welati')).toBeNull();
  });

  it('citizen marks all three steps done with hidden text', async () => {
    impl.load = () => Promise.resolve({ stage: 'citizen', roles: [], trust: 1n });
    const { container } = renderIt();
    await screen.findByRole('region', { name: 'Steps' });
    expect(container.querySelectorAll('.steps .tick')).toHaveLength(3);
    expect(container.querySelectorAll('.steps .sr-only')).toHaveLength(3);
    expect(container.querySelectorAll('.steps li.done')).toHaveLength(3);
  });

  it('error status shows the error text and a retry button', async () => {
    impl.load = () => Promise.reject(new Error('down'));
    renderIt();
    expect(await screen.findAllByText(/could not be loaded/)).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });

  it('no open account redirects to open with next and loads nothing', async () => {
    storage.remove('account');
    renderIt();
    expect(await screen.findByTestId('where')).toHaveTextContent('/account/open?next=/citizenship');
    expect(impl.calls).toBe(0);
  });

  it('the population directorate button sits under the experts button and opens an under-construction dialog', async () => {
    renderIt();
    const btn = await screen.findByRole('button', { name: 'General Directorate of Population and Citizenship Affairs' });
    const experts = screen.getByRole('link', { name: /For experts/ });
    expect(experts.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(btn).toHaveClass('btn', 'btn-quiet');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(btn);
    const dialog = await screen.findByRole('dialog', { name: 'Under construction' });
    expect(dialog).toHaveTextContent('This service will be available here soon.');
    // The footer button (by its visible text), not the header X, which is an icon with only an aria-label.
    fireEvent.click(within(dialog).getByText('Close', { selector: 'button' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('the directorate button and dialog read in Kurmanji', async () => {
    await i18n.changeLanguage('kmr');
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Rêveberiya Giştî ya Karên Gelhe û Hevwelatiyan' }));
    expect(await screen.findByRole('dialog', { name: 'Di qonaxa avakirinê de ye' })).toBeInTheDocument();
  });
});

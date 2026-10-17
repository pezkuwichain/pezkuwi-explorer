import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';
import { NETWORK_ID } from '../config/network';
import Citizenship from './Citizenship';

// A mainnet page (the default for a first visit): the card names the network for people, never "PEZKUWICHAIN · PEZKUWI".
const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
vi.mock('../data/citizenship', () => ({ loadCitizenship: () => Promise.resolve({ stage: 'citizen', roles: ['Welati'], trust: 86n, nftId: 57n }) }));

describe('citizen card on mainnet', () => {
  it('reads PEZKUWICHAIN on the front and the localised mainnet name on the back', async () => {
    expect(NETWORK_ID).toBe('mainnet');
    for (const [lang, label] of [['en', 'Mainnet'], ['tr', 'Ana ağ'], ['kmr', 'Tora sereke']] as const) {
      await i18n.changeLanguage(lang);
      storage.set('account', ALICE);
      const r = render(<MemoryRouter><AccountProvider><Citizenship /></AccountProvider></MemoryRouter>);
      await waitFor(() => expect(document.querySelector('.cid-front')).not.toBeNull());
      const net = document.querySelector('.cid-front .cid-net')!;
      expect(net.textContent).toContain('PEZKUWICHAIN');
      expect(net.textContent).not.toMatch(/PEZKUWI\b|ZAGROS/);
      expect(document.querySelector('.cid-back .cid-pair .cid-value')).toHaveTextContent(label);
      r.unmount();
    }
    await i18n.changeLanguage('en');
  });
});

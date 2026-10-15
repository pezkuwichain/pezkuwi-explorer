import { describe, expect, it, vi } from 'vitest';

const A = '5F3ydAf91e1kcSW5NWXgBamHowmJbjSz8b1Gvd41MyzLCNpd';
const B = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
vi.mock('@pezkuwi/extension-dapp', () => ({
  web3Enable: () => Promise.resolve([{ name: 'polkadot-js' }, { name: 'pezkuwi-wallet' }]),
  // The same provider under two names lists each account twice.
  web3Accounts: () => Promise.resolve([{ address: A }, { address: B }, { address: A }, { address: B }]),
}));

describe('extension accounts', () => {
  it('lists each account once when the wallet injects one provider under several names', async () => {
    const { extensionAccounts } = await import('./extension');
    expect(await extensionAccounts()).toEqual([A, B]);
  });
});

import { web3Accounts, web3Enable } from '@pezkuwi/extension-dapp';

export class NoWalletError extends Error {}
export class RejectedError extends Error {}

// Reads addresses only: web3Enable + web3Accounts. No signing API is ever touched.
export async function extensionAccounts(): Promise<string[]> {
  const ext = await web3Enable('Pezkuwi Explorer');
  if (ext.length === 0) throw new NoWalletError();
  const accounts = await web3Accounts();
  if (accounts.length === 0) throw new RejectedError();
  // The wallet's browser injects one provider under several names (Android: 'polkadot-js', 'pezkuwi-wallet',
  // 'pezkuwi-js' are the same object), so web3Accounts lists each account once per name.
  return [...new Set(accounts.map((a) => a.address))];
}

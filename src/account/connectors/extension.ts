import { web3Accounts, web3Enable } from '@pezkuwi/extension-dapp';
import { withTimeout } from '../../lib/timeout';

export class NoWalletError extends Error {}
export class RejectedError extends Error {}

// pwap waits 20 s for the extension to answer (web3EnableWithTimeout): long enough to approve the popup, short
// enough that a blocked popup does not leave the button spinning for ever.
export const ENABLE_TIMEOUT_MS = 20_000;

// One account the extension shares: its address and the name the user gave it there.
export type ExtensionAccount = { address: string; name: string | null; source: string | null };

// Whether any extension has injected itself into the page. pwap tells "installed but not authorised" from
// "not installed" by this: web3Enable returns nothing in both cases.
export function hasInjected(): boolean {
  try { return !!(window as unknown as { injectedWeb3?: Record<string, unknown> }).injectedWeb3; } catch { return false; }
}

// Reads addresses only: web3Enable + web3Accounts. No signing API is ever touched.
// NoWalletError: no extension answered. RejectedError: it answered with no accounts. TimeoutError (lib/timeout):
// it did not answer within ENABLE_TIMEOUT_MS.
export async function extensionAccounts(): Promise<ExtensionAccount[]> {
  const ext = await withTimeout(web3Enable('Pezkuwi Explorer'), ENABLE_TIMEOUT_MS);
  if (ext.length === 0) throw new NoWalletError();
  const accounts = await web3Accounts();
  if (accounts.length === 0) throw new RejectedError();
  return accounts.map((a) => ({ address: a.address, name: a.meta?.name || null, source: a.meta?.source || null }));
}

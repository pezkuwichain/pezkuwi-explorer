import { PREFIX, storage } from '../lib/storage';

// The keys of the personal data the i-Wallet keeps in this browser, and the calls that forget it. Kept apart from
// citizen.ts (chain code) so the always-loaded IWalletProvider can clear them without loading the wallet's chain and
// crypto code (the i-Wallet screens load on demand, App.tsx).

// Personal data is kept only in this browser's localStorage (via src/lib/storage.ts), keyed by the wallet address.
export const formKey = (address: string) => `iwallet-citizen:${address}`;
export const clearForm = (address: string): void => storage.remove(formKey(address));

export function clearAllForms(): void {
  const prefix = PREFIX + formKey('');
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch { /* storage unavailable: nothing was kept */ }
}

export const teleportKey = (address: string) => `${PREFIX}iwallet-teleport:${address}`;
export function clearTeleportSent(address: string): void {
  try { sessionStorage.removeItem(teleportKey(address)); } catch { /* nothing to remove */ }
}

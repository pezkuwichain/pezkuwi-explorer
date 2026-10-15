import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { normaliseAddress } from '../lib/address';
import { storage } from '../lib/storage';
import { WC_DISCONNECTED, WC_SESSION_KEY, disconnectWalletConnect, restoreWalletConnect } from './connectors/walletconnect';

// How the account was opened. A WalletConnect account has a live session with the wallet that sign-out ends.
export type Source = 'walletconnect' | 'extension' | 'address';
const SOURCES: readonly Source[] = ['walletconnect', 'extension', 'address'];

type Ctx = { address: string | null; source: Source | null; open(address: string, source?: Source): boolean; forget(): void };
const AccountCtx = createContext<Ctx | null>(null);

const readSource = (): Source => SOURCES.find((s) => s === storage.get('account-source')) ?? 'address';

export function AccountProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => normaliseAddress(storage.get('account') ?? ''));
  const [source, setSource] = useState<Source | null>(() => (address ? readSource() : null));
  const open = useCallback((input: string, how: Source = 'address') => {
    const a = normaliseAddress(input);
    if (!a) return false;
    // A WalletConnect session kept for an earlier account must not outlive it. A new WalletConnect pairing
    // has already replaced it (the connector ends the earlier one on approval); any other way ends it here,
    // in the background.
    if (how !== 'walletconnect' && storage.get(WC_SESSION_KEY)) void disconnectWalletConnect().catch(() => {});
    storage.set('account', a);
    storage.set('account-source', how);
    setAddress(a);
    setSource(how);
    return true;
  }, []);
  const clear = useCallback(() => {
    storage.remove('account');
    storage.remove('account-source');
    setAddress(null);
    setSource(null);
  }, []);
  // Sign-out. The wallet session is ended in the background; the screen never waits for the relay.
  const forget = useCallback(() => {
    const wasWc = readSource() === 'walletconnect';
    clear();
    if (wasWc) void disconnectWalletConnect().catch(() => {});
  }, [clear]);

  // A WalletConnect account signs out when the wallet ends the session (session_delete or expiry).
  useEffect(() => {
    if (source !== 'walletconnect') return;
    // Heard only while this account is open: once another opens, this listener is gone, so ending the
    // earlier session (its event arrives after the relay answers) never signs the new account out.
    const onEnd = () => clear();
    window.addEventListener(WC_DISCONNECTED, onEnd);
    // After a reload the client is not running; restore it so the wallet ending the session is heard, and
    // sign out if the wallet already ended it. A relay that cannot be reached changes nothing.
    let live = true;
    restoreWalletConnect().then((r) => { if (live && r.state === 'gone') clear(); }, () => {});
    return () => { live = false; window.removeEventListener(WC_DISCONNECTED, onEnd); };
  }, [source, clear]);

  return <AccountCtx.Provider value={{ address, source, open, forget }}>{children}</AccountCtx.Provider>;
}

export function useAccount(): Ctx {
  const c = useContext(AccountCtx);
  if (!c) throw new Error('useAccount outside AccountProvider');
  return c;
}

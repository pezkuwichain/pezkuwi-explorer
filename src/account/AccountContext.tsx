import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { normaliseAddress } from '../lib/address';
import { storage } from '../lib/storage';
import { TimeoutError } from '../lib/timeout';
import { extensionAccounts, hasInjected, NoWalletError, RejectedError } from './connectors/extension';
import {
  WC_CONNECTED, WC_DISCONNECTED, WC_SESSION_KEY, disconnectWalletConnect, restoreWalletConnect, sessionPeerName, startPairing,
} from './connectors/walletconnect';

// How the account was opened. A WalletConnect account has a live session with the wallet that sign-out ends.
// 'address': pasted or scanned on /account/open; no wallet is involved.
export type Source = 'walletconnect' | 'extension' | 'address';
const SOURCES: readonly Source[] = ['walletconnect', 'extension', 'address'];

// One account a wallet shared. name and source are what the wallet calls it (pwap's meta.name / meta.source).
export type WalletAccount = { address: string; name: string | null; source: string | null };

// What went wrong while connecting, in pwap's three kinds (WalletModal shows each its own way):
//   authorize  an extension is installed but did not authorise this site
//   notFound   no extension is installed
//   generic    anything else
// key is an i18n key; message is the raw text of an unexpected error (pwap shows err.message).
export type WalletError = { kind: 'authorize' | 'notFound' | 'generic'; key: string | null; message: string | null };

export const CHROME_STORE = 'https://chromewebstore.google.com/search/pezkuwi%7B.js%7D%20extension?hl=en-GB&utm_source=ext_sidebar';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=io.pezkuwichain.wallet';

type Ctx = {
  address: string | null;
  source: Source | null;
  accounts: WalletAccount[];
  wcPeerName: string | null;
  error: WalletError | null;
  open(address: string, source?: Source): boolean;
  selectAccount(address: string): void;
  connectWallet(): Promise<void>;
  connectWalletConnect(): Promise<string>;
  cancelWalletConnect(): void;
  forget(): void;
  walletModalOpen: boolean;
  openWalletModal(): void;
  closeWalletModal(): void;
};
const AccountCtx = createContext<Ctx | null>(null);

const readSource = (): Source => SOURCES.find((s) => s === storage.get('account-source')) ?? 'address';
const fail = (kind: WalletError['kind'], key: string | null, message: string | null = null): WalletError => ({ kind, key, message });

// Each address once, in the network's form, keeping the first name the wallet gave it.
function normaliseAccounts(list: WalletAccount[]): WalletAccount[] {
  const out: WalletAccount[] = [];
  for (const a of list) {
    const address = normaliseAddress(a.address);
    if (address && !out.some((x) => x.address === address)) out.push({ ...a, address });
  }
  return out;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => normaliseAddress(storage.get('account') ?? ''));
  const [source, setSource] = useState<Source | null>(() => (address ? readSource() : null));
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [wcPeerName, setWcPeerName] = useState<string | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const wcCtl = useRef<AbortController | null>(null);

  // Makes a (valid) address the open account and remembers how it was opened.
  const put = useCallback((input: string, how: Source) => {
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

  // Paste or scan on /account/open: an address with no wallet behind it.
  const open = useCallback((input: string, how: Source = 'address') => {
    if (!put(input, how)) return false;
    if (how === 'address') { setAccounts([]); setWcPeerName(null); setError(null); }
    return true;
  }, [put]);

  // Another of the accounts the wallet shared (pwap setSelectedAccount); the way it was opened stays.
  const selectAccount = useCallback((a: string) => { put(a, readSource()); }, [put]);

  const clear = useCallback(() => {
    storage.remove('account');
    storage.remove('account-source');
    setAddress(null);
    setSource(null);
    setAccounts([]);
    setWcPeerName(null);
  }, []);
  // Sign-out (pwap disconnectWallet). The wallet session is ended in the background; the screen never waits
  // for the relay.
  const forget = useCallback(() => {
    const wasWc = readSource() === 'walletconnect';
    clear();
    if (wasWc) void disconnectWalletConnect().catch(() => {});
  }, [clear]);

  // The browser extension (pwap connectWallet): the saved account if the extension still has it, else its first.
  const connectWallet = useCallback(async () => {
    setError(null);
    // Read before asking: web3Enable returns nothing both when the extension is missing and when it refuses.
    const installed = hasInjected();
    try {
      const list = normaliseAccounts(await extensionAccounts());
      if (list.length === 0) { setError(fail('generic', 'walletModal.errNoAccounts')); return; }
      setAccounts(list);
      const saved = storage.get('account');
      put((list.find((a) => a.address === saved) ?? list[0]).address, 'extension');
      setWcPeerName(null);
    } catch (e) {
      if (e instanceof NoWalletError) {
        if (installed) setError(fail('authorize', 'walletModal.errAuthorize'));
        else {
          setError(fail('notFound', 'walletModal.errNotFound'));
          window.open(CHROME_STORE, '_blank', 'noopener,noreferrer');
        }
      } else if (e instanceof RejectedError) setError(fail('generic', 'walletModal.errNoAccounts'));
      else if (e instanceof TimeoutError) setError(fail('generic', 'walletModal.errExtensionTimeout'));
      else setError(fail('generic', e instanceof Error && e.message ? null : 'walletModal.errFailed', e instanceof Error && e.message ? e.message : null));
    }
  }, [put]);

  // WalletConnect (pwap connectWalletConnect): starts a pairing and returns its wc: URI. The approval is awaited
  // in the background; when it comes the accounts open and WC_CONNECTED is fired. A newer pairing, or
  // cancelWalletConnect, cancels this one (an approval that arrives after that is disconnected, never opened).
  const connectWalletConnect = useCallback(async () => {
    wcCtl.current?.abort();
    const ctl = new AbortController();
    wcCtl.current = ctl;
    setError(null);
    let pairing: Awaited<ReturnType<typeof startPairing>>;
    try {
      pairing = await startPairing(ctl.signal);
    } catch (e) {
      if (!ctl.signal.aborted) setError(fail('generic', 'walletModal.errWcStart'));
      throw e;
    }
    pairing.approval().then((shared) => {
      const peer = sessionPeerName();
      const list = normaliseAccounts(shared.map((a) => ({ address: a, name: peer || 'WalletConnect', source: 'walletconnect' })));
      if (list.length === 0) return;
      setAccounts(list);
      put(list[0].address, 'walletconnect');
      setWcPeerName(peer);
      window.dispatchEvent(new Event(WC_CONNECTED));
    }, () => {
      if (!ctl.signal.aborted) setError(fail('generic', 'walletModal.errWcRejected'));
    });
    return pairing.uri;
  }, [put]);
  const cancelWalletConnect = useCallback(() => { wcCtl.current?.abort(); wcCtl.current = null; }, []);
  useEffect(() => () => wcCtl.current?.abort(), []);

  // Restore on load, extension: ask the extension again for the saved account (pwap restoreWallet). Only for an
  // account the extension opened; a pasted address never wakes the extension. If the extension does not answer,
  // the address stays open as it was.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || source !== 'extension' || !address) return;
    restored.current = true;
    let live = true;
    extensionAccounts().then((raw) => {
      const list = normaliseAccounts(raw);
      if (live && list.some((a) => a.address === address)) setAccounts(list);
    }, () => {});
    return () => { live = false; };
    // Once, for the account the page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A WalletConnect account signs out when the wallet ends the session (session_delete or expiry).
  useEffect(() => {
    if (source !== 'walletconnect') return;
    // Heard only while this account is open: once another opens, this listener is gone, so ending the
    // earlier session (its event arrives after the relay answers) never signs the new account out.
    const onEnd = () => clear();
    window.addEventListener(WC_DISCONNECTED, onEnd);
    // After a reload the client is not running; restore it so the wallet ending the session is heard, and
    // sign out if the wallet already ended it. A live session brings back its accounts and the wallet's name.
    // A relay that cannot be reached changes nothing.
    let live = true;
    restoreWalletConnect().then((r) => {
      if (!live) return;
      if (r.state === 'gone') { clear(); return; }
      if (r.state !== 'live') return;
      const list = normaliseAccounts(r.accounts.map((a) => ({ address: a, name: r.peerName || 'WalletConnect', source: 'walletconnect' })));
      if (list.length === 0) return;
      setAccounts(list);
      setWcPeerName(r.peerName);
      const saved = storage.get('account');
      if (!list.some((a) => a.address === saved)) put(list[0].address, 'walletconnect');
    }, () => {});
    return () => { live = false; window.removeEventListener(WC_DISCONNECTED, onEnd); };
  }, [source, clear, put]);

  const openWalletModal = useCallback(() => setWalletModalOpen(true), []);
  const closeWalletModal = useCallback(() => setWalletModalOpen(false), []);

  return (
    <AccountCtx.Provider value={{
      address, source, accounts, wcPeerName, error, open, selectAccount, connectWallet, connectWalletConnect, cancelWalletConnect, forget,
      walletModalOpen, openWalletModal, closeWalletModal,
    }}>{children}</AccountCtx.Provider>
  );
}

export function useAccount(): Ctx {
  const c = useContext(AccountCtx);
  if (!c) throw new Error('useAccount outside AccountProvider');
  return c;
}

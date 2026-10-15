import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AccountProvider, useAccount } from './AccountContext';
import type { ReactNode } from 'react';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const wrapper = ({ children }: { children: ReactNode }) => <AccountProvider>{children}</AccountProvider>;

describe('account context', () => {
  it('opens, remembers and forgets an account', () => {
    const { result } = renderHook(() => useAccount(), { wrapper });
    act(() => { expect(result.current.open(ALICE)).toBe(true); });
    expect(result.current.address).toBe(ALICE);
    expect(renderHook(() => useAccount(), { wrapper }).result.current.address).toBe(ALICE);
    act(() => result.current.forget());
    expect(result.current.address).toBeNull();
  });
  it('rejects invalid input without changing the open account', () => {
    const { result } = renderHook(() => useAccount(), { wrapper });
    act(() => { expect(result.current.open('nope')).toBe(false); });
    expect(result.current.address).toBeNull();
  });
});

describe('sign-out', () => {
  // AccountContext with the WalletConnect module replaced, so no client is ever started.
  const withWc = async (restore: () => Promise<unknown> = () => Promise.resolve({ state: 'live', accounts: [] })) => {
    vi.resetModules();
    const disconnect = vi.fn(() => Promise.resolve());
    vi.doMock('./connectors/walletconnect', () => ({ WC_DISCONNECTED: 'wc-off', WC_CONNECTED: 'wc-on', WC_SESSION_KEY: 'wc-session', disconnectWalletConnect: disconnect, restoreWalletConnect: restore, sessionPeerName: () => null, startPairing: () => new Promise(() => {}) }));
    const m = await import('./AccountContext');
    const w = ({ children }: { children: ReactNode }) => <m.AccountProvider>{children}</m.AccountProvider>;
    return { disconnect, hook: () => renderHook(() => m.useAccount(), { wrapper: w }) };
  };
  afterEach(() => { vi.doUnmock('./connectors/walletconnect'); localStorage.clear(); });

  it('remembers how the account was opened', async () => {
    const { hook } = await withWc();
    const { result } = hook();
    act(() => { result.current.open(ALICE, 'extension'); });
    expect(result.current.source).toBe('extension');
    expect(hook().result.current.source).toBe('extension');
  });
  it('ends the WalletConnect session on sign-out, and clears the account', async () => {
    const { hook, disconnect } = await withWc();
    const { result } = hook();
    act(() => { result.current.open(ALICE, 'walletconnect'); });
    act(() => result.current.forget());
    expect(result.current.address).toBeNull();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('pezkuwi-explorer:account-source')).toBeNull();
  });
  it('does not touch WalletConnect for an account opened another way', async () => {
    const { hook, disconnect } = await withWc();
    const { result } = hook();
    act(() => { result.current.open(ALICE, 'address'); });
    act(() => result.current.forget());
    expect(disconnect).not.toHaveBeenCalled();
  });
  it('signs out when the wallet ends the session (session_delete / expire)', async () => {
    const { hook } = await withWc();
    const { result } = hook();
    act(() => { result.current.open(ALICE, 'walletconnect'); });
    act(() => { window.dispatchEvent(new Event('wc-off')); });
    expect(result.current.address).toBeNull();
  });
  it('signs out after a reload when the wallet already ended the kept session', async () => {
    localStorage.setItem('pezkuwi-explorer:account', ALICE);
    localStorage.setItem('pezkuwi-explorer:account-source', 'walletconnect');
    const { hook } = await withWc(() => Promise.resolve({ state: 'gone' }));
    const { result } = hook();
    await waitFor(() => expect(result.current.address).toBeNull());
  });
  it('keeps the account when the relay cannot be reached', async () => {
    localStorage.setItem('pezkuwi-explorer:account', ALICE);
    localStorage.setItem('pezkuwi-explorer:account-source', 'walletconnect');
    const { hook } = await withWc(() => Promise.reject(new Error('offline')));
    const { result } = hook();
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.address).toBe(ALICE);
  });

  it('opening an account any other way (paste, scan, extension) ends the session kept for the earlier account', async () => {
    for (const how of ['address', 'extension'] as const) {
      const { hook, disconnect } = await withWc();
      const { result, unmount } = hook();
      act(() => { result.current.open(ALICE, 'walletconnect'); });
      localStorage.setItem('pezkuwi-explorer:wc-session', 'old');
      act(() => { result.current.open(BOB, how); });
      expect(disconnect).toHaveBeenCalledTimes(1);
      // The ended session's disconnected event does not sign the new account out.
      act(() => { window.dispatchEvent(new Event('wc-off')); });
      expect(result.current.address).toBe(BOB);
      expect(result.current.source).toBe(how);
      unmount();
      localStorage.clear();
    }
  });
  it('a new WalletConnect account does not end its own session', async () => {
    const { hook, disconnect } = await withWc();
    const { result } = hook();
    localStorage.setItem('pezkuwi-explorer:wc-session', 'new');
    act(() => { result.current.open(ALICE, 'walletconnect'); });
    expect(disconnect).not.toHaveBeenCalled();
  });
});

describe('restore on load', () => {
  // AccountContext with both connectors replaced: what the page finds when it loads.
  const load = async (restore: () => Promise<unknown>, extension: () => Promise<unknown>) => {
    vi.resetModules();
    const calls = { restore: vi.fn(restore), extension: vi.fn(extension) };
    vi.doMock('./connectors/walletconnect', () => ({
      WC_DISCONNECTED: 'wc-off', WC_CONNECTED: 'wc-on', WC_SESSION_KEY: 'wc-session', disconnectWalletConnect: () => Promise.resolve(),
      restoreWalletConnect: calls.restore, sessionPeerName: () => null, startPairing: () => new Promise(() => {}),
    }));
    vi.doMock('./connectors/extension', async (orig) => ({ ...(await orig<typeof import('./connectors/extension')>()), extensionAccounts: calls.extension }));
    const m = await import('./AccountContext');
    const w = ({ children }: { children: ReactNode }) => <m.AccountProvider>{children}</m.AccountProvider>;
    return { calls, hook: () => renderHook(() => m.useAccount(), { wrapper: w }) };
  };
  afterEach(() => { vi.doUnmock('./connectors/walletconnect'); vi.doUnmock('./connectors/extension'); localStorage.clear(); });
  const two = [{ address: ALICE, name: 'Alice', source: 'pezkuwi-js' }, { address: BOB, name: 'Bob', source: 'pezkuwi-js' }];

  it('a kept WalletConnect session comes back with its accounts and the wallet name', async () => {
    localStorage.setItem('pezkuwi-explorer:account', BOB);
    localStorage.setItem('pezkuwi-explorer:account-source', 'walletconnect');
    localStorage.setItem('pezkuwi-explorer:wc-session', 'kept');
    const { calls, hook } = await load(() => Promise.resolve({ state: 'live', accounts: [ALICE, BOB], peerName: 'pezWallet' }), () => Promise.resolve(two));
    const { result } = hook();
    await waitFor(() => expect(result.current.accounts.map((a) => a.address)).toEqual([ALICE, BOB]));
    expect(result.current.wcPeerName).toBe('pezWallet');
    expect(result.current.accounts[0].name).toBe('pezWallet');
    expect(result.current.address).toBe(BOB);
    expect(result.current.source).toBe('walletconnect');
    expect(calls.extension).not.toHaveBeenCalled();
  });
  it('a kept WalletConnect session that no longer holds the saved account opens its first one', async () => {
    localStorage.setItem('pezkuwi-explorer:account', BOB);
    localStorage.setItem('pezkuwi-explorer:account-source', 'walletconnect');
    const { hook } = await load(() => Promise.resolve({ state: 'live', accounts: [ALICE], peerName: null }), () => Promise.resolve([]));
    const { result } = hook();
    await waitFor(() => expect(result.current.address).toBe(ALICE));
    expect(result.current.accounts[0].name).toBe('WalletConnect');
  });
  it('else a saved extension account asks the extension again and brings back its accounts', async () => {
    localStorage.setItem('pezkuwi-explorer:account', BOB);
    localStorage.setItem('pezkuwi-explorer:account-source', 'extension');
    const { calls, hook } = await load(() => Promise.resolve({ state: 'none' }), () => Promise.resolve(two));
    const { result } = hook();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    expect(result.current.address).toBe(BOB);
    expect(calls.extension).toHaveBeenCalledTimes(1);
    expect(calls.restore).not.toHaveBeenCalled();
  });
  it('an extension that no longer has the saved account leaves it open as it was, with no list', async () => {
    localStorage.setItem('pezkuwi-explorer:account', BOB);
    localStorage.setItem('pezkuwi-explorer:account-source', 'extension');
    const { calls, hook } = await load(() => Promise.resolve({ state: 'none' }), () => Promise.resolve([two[0]]));
    const { result } = hook();
    await waitFor(() => expect(calls.extension).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.accounts).toEqual([]);
    expect(result.current.address).toBe(BOB);
  });
  it('nothing saved, or a pasted address: no wallet is asked anything', async () => {
    for (const saved of [null, 'address'] as const) {
      if (saved) { localStorage.setItem('pezkuwi-explorer:account', ALICE); localStorage.setItem('pezkuwi-explorer:account-source', saved); }
      const { calls, hook } = await load(() => Promise.resolve({ state: 'none' }), () => Promise.resolve(two));
      const { unmount } = hook();
      await new Promise((r) => setTimeout(r, 10));
      expect(calls.extension).not.toHaveBeenCalled();
      expect(calls.restore).not.toHaveBeenCalled();
      unmount();
      localStorage.clear();
    }
  });
});

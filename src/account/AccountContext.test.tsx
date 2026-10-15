import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AccountProvider, useAccount } from './AccountContext';
import type { ReactNode } from 'react';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
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
    vi.doMock('./connectors/walletconnect', () => ({ WC_DISCONNECTED: 'wc-off', disconnectWalletConnect: disconnect, restoreWalletConnect: restore }));
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
});

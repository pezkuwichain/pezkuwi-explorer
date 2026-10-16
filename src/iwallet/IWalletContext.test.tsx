import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { KeyringPair, KeyringPair$Json } from '@pezkuwi/keyring/types';
import type { KvStore } from './idb';

const impl = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve(null),
  faceId: (): Promise<string | null> => Promise.resolve(null),
  deleted: 0,
}));
vi.mock('./keystore', async (orig) => {
  const m = await orig<typeof import('./keystore')>();
  return {
    ...m,
    loadKeystore: () => impl.load(),
    deleteKeystore: () => { impl.deleted++; return Promise.resolve(); },
    unlock: (_j: unknown, pw: string) => {
      if (pw !== 'right') return Promise.reject(new m.WrongPasswordError());
      return Promise.resolve(makePair());
    },
  };
});
vi.mock('./faceid', () => ({ unlockWithFaceId: () => impl.faceId() }));

import { WrongPasswordError } from './keystore';
import { HIDDEN_LOCK_MS, IDLE_LOCK_MS, IWalletProvider, useIWallet } from './IWalletContext';

const JSON_: KeyringPair$Json = { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } as KeyringPair$Json;
let lockCalls = 0;
const made: { isLocked: boolean }[] = [];
const makePair = (): KeyringPair => {
  const p = { address: JSON_.address, isLocked: false, lock() { p.isLocked = true; lockCalls++; } };
  made.push(p);
  return p as unknown as KeyringPair;
};
const store = {} as KvStore;
const wrapper = ({ children }: { children: ReactNode }) => <IWalletProvider store={store}>{children}</IWalletProvider>;
const setHidden = (v: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('IWalletContext', () => {
  beforeEach(() => { impl.load = () => Promise.resolve(JSON_); impl.faceId = () => Promise.resolve(null); impl.deleted = 0; lockCalls = 0; made.length = 0; });
  afterEach(() => { vi.useRealTimers(); setHidden(false); });

  it('goes loading -> none when nothing is stored', async () => {
    impl.load = () => Promise.resolve(null);
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    expect(['idle', 'loading']).toContain(result.current.state);
    await waitFor(() => expect(result.current.state).toBe('none'));
    expect(result.current.address).toBeNull();
  });

  it('goes none -> locked once a stored keystore loads', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    expect(result.current.address).toBe(JSON_.address);
    expect(result.current.pair).toBeNull();
  });

  it('is unavailable when storage throws', async () => {
    impl.load = () => Promise.reject(new Error('no idb'));
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
  });

  it('stays locked on a wrong password and unlocks on the right one', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await expect(result.current.unlock('nope')).rejects.toBeInstanceOf(WrongPasswordError); });
    expect(result.current.state).toBe('locked');
    await act(async () => { await result.current.unlock('right'); });
    expect(result.current.state).toBe('unlocked');
    expect(result.current.pair).not.toBeNull();
  });

  it('Face ID: the stored password unlocks; a cancelled prompt stays locked without error', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await result.current.unlockFaceId(); });
    expect(result.current.state).toBe('locked');
    impl.faceId = () => Promise.resolve('right');
    await act(async () => { await result.current.unlockFaceId(); });
    expect(result.current.state).toBe('unlocked');
  });

  it('drops the pair after 5 idle minutes, and activity restarts the timer', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await result.current.unlock('right'); });
    vi.useFakeTimers();
    act(() => { vi.advanceTimersByTime(IDLE_LOCK_MS - 1000); });
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    act(() => { vi.advanceTimersByTime(IDLE_LOCK_MS - 1000); });
    expect(result.current.state).toBe('unlocked');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.state).toBe('locked');
    expect(result.current.pair).toBeNull();
    expect(lockCalls).toBe(1);
    expect(made[0].isLocked).toBe(true);
  });

  it('locks the previous pair when a second unlock replaces it', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await result.current.unlock('right'); });
    await act(async () => { await result.current.unlock('right'); });
    expect(made).toHaveLength(2);
    expect(made[0].isLocked).toBe(true);
    expect(made[1].isLocked).toBe(false);
  });

  it('does not read the store until ensureLoaded is called', async () => {
    const load = vi.fn(() => Promise.resolve(JSON_));
    impl.load = load;
    const { result } = renderHook(() => useIWallet(), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.state).toBe('idle');
    expect(load).not.toHaveBeenCalled();
    act(() => { result.current.ensureLoaded(); result.current.ensureLoaded(); });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('locks after 60 s hidden, but not if the page returns first', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await result.current.unlock('right'); });
    vi.useFakeTimers();
    act(() => { setHidden(true); vi.advanceTimersByTime(HIDDEN_LOCK_MS - 1000); });
    act(() => { setHidden(false); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.state).toBe('unlocked');
    act(() => { setHidden(true); vi.advanceTimersByTime(HIDDEN_LOCK_MS); });
    expect(result.current.state).toBe('locked');
    expect(result.current.pair).toBeNull();
  });

  it('setCreated adopts the wallet and remove deletes it', async () => {
    impl.load = () => Promise.resolve(null);
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('none'));
    act(() => { result.current.setCreated(JSON_, makePair()); });
    expect(result.current.state).toBe('unlocked');
    expect(result.current.address).toBe(JSON_.address);
    await act(async () => { await result.current.remove(); });
    expect(impl.deleted).toBe(1);
    expect(result.current.state).toBe('none');
    expect(result.current.pair).toBeNull();
  });

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/IWalletProvider/);
    spy.mockRestore();
  });
});

function Probe() { useIWallet(); return null; }

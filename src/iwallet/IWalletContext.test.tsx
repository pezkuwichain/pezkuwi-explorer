import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { KeyringPair$Json } from '@pezkuwi/keyring/types';
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
    // The context only proves the password; the pair it decrypts is locked at once.
    verifyPassword: (_j: unknown, pw: string) => {
      if (pw !== 'right') return Promise.reject(new m.WrongPasswordError());
      makePair().lock();
      return Promise.resolve();
    },
  };
});
vi.mock('./faceid', () => ({ unlockWithFaceId: () => impl.faceId() }));

import { WrongPasswordError } from './keystore';
import { HIDDEN_LOCK_MS, IDLE_LOCK_MS, IWalletProvider, useIWallet } from './IWalletContext';

const JSON_: KeyringPair$Json = { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } as KeyringPair$Json;
let lockCalls = 0;
const made: { isLocked: boolean }[] = [];
const makePair = () => {
  const p = { address: JSON_.address, isLocked: false, lock() { p.isLocked = true; lockCalls++; } };
  made.push(p);
  return p;
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
    expect('pair' in result.current).toBe(false);
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
    // No decrypted key stays in the session: the pair that proved the password is already locked.
    expect('pair' in result.current).toBe(false);
    expect(made).toHaveLength(1);
    expect(made[0].isLocked).toBe(true);
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
  });

  it('every unlock locks the pair it decrypted', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await result.current.unlock('right'); });
    await act(async () => { await result.current.unlock('right'); });
    expect(made).toHaveLength(2);
    expect(made.every((p) => p.isLocked)).toBe(true);
    expect(lockCalls).toBe(2);
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
  });

  // iOS suspends timers in the background: the lock must follow the wall clock, not a timer that may never fire.
  describe('wall-clock auto-lock (timers never fire here)', () => {
    let now = 0;
    const unlocked = async () => {
      const r = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
      await waitFor(() => expect(r.result.current.state).toBe('locked'));
      await act(async () => { await r.result.current.unlock('right'); });
      expect(r.result.current.state).toBe('unlocked');
      return r.result;
    };
    beforeEach(() => { now = 1_000_000; vi.spyOn(Date, 'now').mockImplementation(() => now); });
    afterEach(() => { vi.mocked(Date.now).mockRestore(); });

    it('hidden for 61 s, then visible: locked even though the 60 s timer never ran', async () => {
      const result = await unlocked();
      act(() => { setHidden(true); });
      now += HIDDEN_LOCK_MS + 1000;
      act(() => { setHidden(false); });
      expect(result.current.state).toBe('locked');
    });

    it('hidden for 30 s, then visible: still unlocked', async () => {
      const result = await unlocked();
      act(() => { setHidden(true); });
      now += 30_000;
      act(() => { setHidden(false); });
      expect(result.current.state).toBe('unlocked');
    });

    it('a bfcache return (pageshow) after a long background locks', async () => {
      const result = await unlocked();
      act(() => { setHidden(true); });
      now += 10 * 60_000;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      act(() => { window.dispatchEvent(new Event('pageshow')); });
      expect(result.current.state).toBe('locked');
    });

    it('5 idle minutes lock when the window regains focus', async () => {
      const result = await unlocked();
      now += IDLE_LOCK_MS + 1;
      act(() => { window.dispatchEvent(new Event('focus')); });
      expect(result.current.state).toBe('locked');
    });

    it('an activity after an overdue idle period locks instead of restarting the clock', async () => {
      const result = await unlocked();
      now += IDLE_LOCK_MS + 1;
      act(() => { window.dispatchEvent(new Event('pointerdown')); });
      expect(result.current.state).toBe('locked');
    });
  });

  it('setCreated adopts the wallet and remove deletes it', async () => {
    impl.load = () => Promise.resolve(null);
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('none'));
    act(() => { result.current.setCreated(JSON_); });
    expect(result.current.state).toBe('unlocked');
    expect(result.current.address).toBe(JSON_.address);
    await act(async () => { await result.current.remove(); });
    expect(impl.deleted).toBe(1);
    expect(result.current.state).toBe('none');
  });

  it('remove also deletes the citizenship forms kept in localStorage, and nothing else', async () => {
    localStorage.setItem(`pezkuwi-explorer:iwallet-citizen:${JSON_.address}`, '{"fullName":"x"}');
    localStorage.setItem('pezkuwi-explorer:iwallet-citizen:5OtherWalletOnThisDevice', '{"fullName":"y"}');
    localStorage.setItem('pezkuwi-explorer:lang', 'kmr');
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    await act(async () => { await result.current.remove(); });
    expect(localStorage.getItem(`pezkuwi-explorer:iwallet-citizen:${JSON_.address}`)).toBeNull();
    expect(localStorage.getItem('pezkuwi-explorer:iwallet-citizen:5OtherWalletOnThisDevice')).toBeNull();
    expect(localStorage.getItem('pezkuwi-explorer:lang')).toBe('kmr');
    localStorage.clear();
  });

  it('a lock keeps a held screen open; releasing the hold shows the lock', async () => {
    const { result } = renderHook(() => { const w = useIWallet(); useEffect(() => w.ensureLoaded(), [w.ensureLoaded]); return w; }, { wrapper });
    await waitFor(() => expect(result.current.state).toBe('locked'));
    expect(result.current.holdOpen).toBe(false);
    act(() => { result.current.setHold(true); });
    expect(result.current.holdOpen).toBe(true);
    act(() => { result.current.setHold(false); result.current.setHold(false); });
    expect(result.current.holdOpen).toBe(false);
  });

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/IWalletProvider/);
    spy.mockRestore();
  });
});

function Probe() { useIWallet(); return null; }

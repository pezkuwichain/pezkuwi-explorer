import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IWalletProvider, useIWallet } from './IWalletContext';
import { lastKeyWorkFailed, useKeyWork, withKeyProgress } from './progress';
import type { KvStore } from './idb';

describe('key-work progress', () => {
  it('names the running work, the latest first, and clears it when it ends', async () => {
    const seen: Array<string | null> = [];
    const { result } = renderHook(() => { const w = useKeyWork(); seen.push(w); return w; });
    let endSign: () => void = () => undefined;
    const gate = new Promise<void>((r) => { endSign = r; });
    let sign!: Promise<void>;
    act(() => { sign = withKeyProgress('sign', () => gate); });
    expect(result.current).toBe('sign');
    await act(async () => { endSign(); await sign; });
    expect(result.current).toBeNull();
    expect(lastKeyWorkFailed()).toBe(false);
    await act(async () => { await expect(withKeyProgress('open', () => Promise.reject(new Error('wrong')))).rejects.toThrow('wrong'); });
    expect(lastKeyWorkFailed()).toBe(true);
    expect(seen).toContain('open');
    expect(result.current).toBeNull();
  });

  it('reading the backup words: no overlay while IndexedDB is read (it has no timeout), only for the decrypt', async () => {
    let answer: (v: unknown) => void = () => undefined;
    const store = { get: () => new Promise((r) => { answer = r; }) } as unknown as KvStore;
    const wrapper = ({ children }: { children: ReactNode }) => <IWalletProvider store={store}>{children}</IWalletProvider>;
    const seen: Array<string | null> = [];
    const { result } = renderHook(() => { const work = useKeyWork(); seen.push(work); return useIWallet(); }, { wrapper });
    let reading!: Promise<string>;
    act(() => { reading = result.current.readWords('pw'); });
    // A hung read: well past the overlay's paint delay, nothing covers the screen.
    await act(() => new Promise((r) => setTimeout(r, 120)));
    expect(seen.every((w) => w === null)).toBe(true);
    // The stored words arrive (malformed here): only now is the password step run, under the overlay.
    await act(async () => { answer({ encoded: 'x' }); await expect(reading).rejects.toThrow(); });
    expect(seen).toContain('open');
    await waitFor(() => expect(seen.at(-1)).toBeNull());
  });
});

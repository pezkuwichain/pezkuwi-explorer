import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

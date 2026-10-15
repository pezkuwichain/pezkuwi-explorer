import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('goes loading -> ok', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(1), []));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ok', data: 1 }));
  });
  it('goes to error and recovers on retry', async () => {
    let fail = true;
    const { result } = renderHook(() => useAsync(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve(2)), []));
    await waitFor(() => expect(result.current.status).toBe('error'));
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ok', data: 2 }));
  });
});

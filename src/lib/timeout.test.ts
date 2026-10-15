// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { withTimeout, TimeoutError } from './timeout';

describe('withTimeout', () => {
  it('resolves when the promise is fast', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
  it('rejects with TimeoutError when the promise never settles', async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 10_000);
    vi.advanceTimersByTime(10_000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    vi.useRealTimers();
  });
});

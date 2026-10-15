// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storage } from './storage';

describe('storage', () => {
  afterEach(() => vi.restoreAllMocks());
  it('round-trips values', () => { expect(storage.set('a', '1')).toBe(true); expect(storage.get('a')).toBe('1'); storage.remove('a'); expect(storage.get('a')).toBeNull(); });
  it('never throws when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked'); });
    expect(() => storage.set('a', '1')).not.toThrow();
    expect(storage.set('a', '1')).toBe(false);
    expect(storage.get('a')).toBeNull();
  });
});

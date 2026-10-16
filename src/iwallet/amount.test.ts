import { describe, expect, it } from 'vitest';
import { parseAmount } from './amount';

describe('parseAmount', () => {
  it('accepts a comma or a dot as the decimal mark', () => {
    expect(parseAmount('1,5', 12)).toBe(1_500_000_000_000n);
    expect(parseAmount('1.5', 12)).toBe(1_500_000_000_000n);
    expect(parseAmount('.5', 6)).toBe(500_000n);
    expect(parseAmount('2.', 6)).toBe(2_000_000n);
    expect(parseAmount(' 12 ', 6)).toBe(12_000_000n);
  });
  it('rejects more decimals than the token has, instead of rounding', () => {
    expect(parseAmount('0.1234567', 6)).toBeNull();
    expect(parseAmount('0.123456', 6)).toBe(123_456n);
    expect(parseAmount('1.0000000000001', 12)).toBeNull();
  });
  it('rejects anything that is not a plain non-negative number', () => {
    for (const bad of ['', ' ', '.', ',', 'abc', '1e3', '-1', '+1', '1.2.3', '1,2,3', '0x10', '1 000', '1.000,5', '1,000.5', '1,000,5']) {
      expect(parseAmount(bad, 12), bad).toBeNull();
    }
  });
  it('parses zero (the screen decides that zero cannot be sent)', () => {
    expect(parseAmount('0', 12)).toBe(0n);
    expect(parseAmount('0.0', 12)).toBe(0n);
  });
});

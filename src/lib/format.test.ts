// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatAmount, relativeTime } from './format';

describe('formatAmount', () => {
  it('formats whole and fractional HEZ', () => {
    expect(formatAmount(5_000_000_000_000n, 12, 'HEZ', 'en')).toBe('5 HEZ');
    expect(formatAmount(1_250_000_000_000n, 12, 'HEZ', 'en')).toBe('1.25 HEZ');
  });
  it('keeps the smallest unit visible instead of rounding to zero', () => {
    expect(formatAmount(1n, 12, 'HEZ', 'en')).toBe('0.000000000001 HEZ');
  });
  it('never uses scientific notation for huge values', () => {
    expect(formatAmount(10n ** 30n, 12, 'HEZ', 'en')).toBe('1,000,000,000,000,000,000 HEZ');
  });
  it('respects 6-decimal assets', () => {
    expect(formatAmount(1_500_000n, 6, 'wUSDT', 'en')).toBe('1.5 wUSDT');
  });
  it('shows at most 4 fractional digits once the whole part is non-zero', () => {
    expect(formatAmount(1_234_567_890_000n, 12, 'HEZ', 'en')).toBe('1.2345 HEZ');
  });
});

describe('relativeTime', () => {
  it('says minutes and hours in the chosen language', () => {
    const now = 1_800_000_000;
    expect(relativeTime(now - 120, now, 'en')).toBe('2 minutes ago');
    expect(relativeTime(now - 7200, now, 'en')).toBe('2 hours ago');
  });
});

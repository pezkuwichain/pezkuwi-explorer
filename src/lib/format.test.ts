// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { dayKey, dayLabel, formatAmount, formatCompact, formatExact, formatNumber, formatPercent, relativeTime } from './format';

describe('formatAmount', () => {
  it('formats whole and fractional HEZ', () => {
    expect(formatAmount(5_000_000_000_000n, 12, 'HEZ', 'en')).toBe('5 HEZ');
    expect(formatAmount(1_250_000_000_000n, 12, 'HEZ', 'en')).toBe('1.25 HEZ');
  });
  it('keeps the smallest unit visible instead of rounding to zero', () => {
    expect(formatAmount(1n, 12, 'HEZ', 'en')).toBe('<0.0001 HEZ');
    expect(formatAmount(966_245_000n, 12, 'HEZ', 'en')).toBe('≈0.0009 HEZ');
    expect(formatAmount(10_800_000_000n, 12, 'HEZ', 'en')).toBe('0.0108 HEZ');
  });
  it('never uses scientific notation for huge values', () => {
    expect(formatAmount(10n ** 30n, 12, 'HEZ', 'en')).toBe('1,000,000,000,000,000,000 HEZ');
  });
  it('respects 6-decimal assets', () => {
    expect(formatAmount(1_500_000n, 6, 'USDT', 'en')).toBe('1.5 USDT');
  });
  it('shows at most 4 fractional digits, marked ≈ when digits were cut', () => {
    expect(formatAmount(1_234_567_890_000n, 12, 'HEZ', 'en')).toBe('≈1.2345 HEZ');
    expect(formatAmount(4_999_960_000_000n, 12, 'HEZ', 'en')).toBe('≈4.9999 HEZ');
    expect(formatAmount(4_999_900_000_000n, 12, 'HEZ', 'en')).toBe('4.9999 HEZ');
  });
});

describe('relativeTime', () => {
  it('says minutes and hours in the chosen language', () => {
    const now = 1_800_000_000;
    expect(relativeTime(now - 120, now, 'en')).toBe('2 minutes ago');
    expect(relativeTime(now - 7200, now, 'en')).toBe('2 hours ago');
  });
});

describe('localised digits', () => {
  const numberPart = (s: string) => s.slice(0, s.lastIndexOf(' '));

  it('uses the locale digits and decimal separator for ckb', () => {
    const out = formatAmount(1_250_000_000_000n, 12, 'HEZ', 'ckb');
    expect(numberPart(out)).not.toMatch(/[0-9]/);
    const sep = new Intl.NumberFormat('ckb').formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
    expect(numberPart(out)).toContain(sep);
  });

  it('uses the locale digits and decimal separator for fa', () => {
    const out = formatAmount(1_250_000_000_000n, 12, 'HEZ', 'fa');
    expect(numberPart(out)).not.toMatch(/[0-9]/);
    const sep = new Intl.NumberFormat('fa').formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
    expect(numberPart(out)).toContain(sep);
  });

  it('keeps exact truncation with localised fraction digits', () => {
    expect(formatAmount(1_234_567_890_000n, 12, 'HEZ', 'fa')).toBe('≈' +
      new Intl.NumberFormat('fa').format(1n) +
        new Intl.NumberFormat('fa').formatToParts(1.5).find((p) => p.type === 'decimal')!.value +
        [...'2345'].map((d) => new Intl.NumberFormat('fa').format(BigInt(d))).join('') +
        ' HEZ',
    );
  });
});

describe('relativeTime with a translator', () => {
  it('returns an empty string for non-finite times instead of throwing', () => {
    expect(relativeTime(NaN, 1_800_000_000, 'en')).toBe('');
    expect(relativeTime(1_800_000_000, Infinity, 'en')).toBe('');
  });
  it('uses the translator for ckb past times', () => {
    const now = 1_800_000_000;
    const t = (key: string, opts: { count: number }) => `${key}:${opts.count}`;
    expect(relativeTime(now - 120, now, 'ckb', t)).toBe('time.minutesAgo:2');
    expect(relativeTime(now - 7200, now, 'ckb', t)).toBe('time.hoursAgo:2');
    expect(relativeTime(now - 2 * 86400, now, 'ckb', t)).toBe('time.daysAgo:2');
  });
  it('uses the translator when the runtime has no relative-time data for the language (Chrome and Kurmanji)', () => {
    const now = 1_800_000_000;
    const t = (key: string, opts: { count: number }) => `${key}:${opts.count}`;
    const spy = vi.spyOn(Intl.RelativeTimeFormat, 'supportedLocalesOf').mockImplementation((l) => ([] as string[]).concat(l as string).filter((x) => x !== 'ku'));
    try {
      expect(relativeTime(now - 7200, now, 'kmr', t)).toBe('time.hoursAgo:2');
      expect(relativeTime(now - 7200, now, 'en', t)).toBe('2 hours ago');
    } finally { spy.mockRestore(); }
  });
});

describe('formatCompact', () => {
  const HEZ = (whole: bigint, frac = 0n) => whole * 10n ** 12n + frac;
  it('shortens large amounts to one fractional digit with a scale word', () => {
    expect(formatCompact(HEZ(40_258_000n), 12, 'en')).toBe('≈40.2M');
    expect(formatCompact(HEZ(1_234n), 12, 'en')).toBe('≈1.2K');
    expect(formatCompact(HEZ(3_500_000_000_000n), 12, 'en')).toBe('3.5T');
    expect(formatCompact(HEZ(40_200_000n), 12, 'en')).toBe('40.2M');
  });
  it('truncates instead of rounding up, so a figure never reads higher than it is', () => {
    expect(formatCompact(HEZ(1_999_999n), 12, 'en')).toBe('≈1.9M');
    expect(formatCompact(HEZ(999n, 999_999_999_999n), 12, 'en')).toBe('≈999.9999');
  });
  it('truncates before formatting, so a browser without roundingMode cannot round up', () => {
    const Real = Intl.NumberFormat;
    // A runtime that ignores roundingMode rounds half-expand: 1.96M would read 2M.
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (tag: string, o?: Intl.NumberFormatOptions) {
      const rest = { ...o }; delete rest.roundingMode; return new Real(tag, rest);
    } as never);
    try {
      expect(formatCompact(HEZ(1_960_000n), 12, 'en')).toBe('≈1.9M');
      expect(formatCompact(HEZ(19_990n), 12, 'en')).toBe('≈19.9K');
    } finally { spy.mockRestore(); }
  });
  it('below a thousand it is the exact amount, as formatAmount shows it', () => {
    expect(formatCompact(HEZ(7n), 12, 'en')).toBe('7');
    expect(formatCompact(1n, 12, 'en')).toBe('<0.0001');
    expect(formatCompact(1_500_000n, 6, 'en')).toBe('1.5');
  });
  it('uses the locale digits', () => {
    const out = formatCompact(HEZ(40_258_000n), 12, 'fa');
    expect(out).not.toMatch(/[0-9]/);
    expect(out).toContain(new Intl.NumberFormat('fa').format(40));
  });
  it('handles huge values without scientific notation', () => {
    expect(formatCompact(10n ** 30n, 12, 'en')).not.toMatch(/e/i);
  });
});

describe('formatExact', () => {
  it('writes every digit, never ≈', () => {
    expect(formatExact(4_999_960_000_000n, 12, 'HEZ', 'en')).toBe('4.99996 HEZ');
    expect(formatExact(40_258_000n * 10n ** 12n, 12, 'HEZ', 'en')).toBe('40,258,000 HEZ');
  });
});

describe('formatNumber', () => {
  it('is the number part of formatAmount', () => {
    expect(formatNumber(1_250_000_000_000n, 12, 'en')).toBe('1.25');
    expect(formatAmount(1_250_000_000_000n, 12, 'HEZ', 'en')).toBe(`${formatNumber(1_250_000_000_000n, 12, 'en')} HEZ`);
  });
});

describe('formatPercent', () => {
  it('formats a share as a whole percentage in the locale', () => {
    expect(formatPercent(68, 'en')).toBe('68%');
    expect(formatPercent(68, 'fa')).not.toMatch(/[0-9]/);
  });
});

describe('day headers', () => {
  const t = (k: 'day.today' | 'day.yesterday') => k;
  // Local noon, so the test holds in any time zone.
  const noon = new Date(2027, 2, 21, 12, 0, 0).getTime() / 1000;
  it('groups by local calendar day', () => {
    expect(dayKey(noon)).toBe(dayKey(noon + 3600));
    expect(dayKey(noon)).not.toBe(dayKey(noon - 86400));
  });
  it('says today, yesterday, then the date', () => {
    expect(dayLabel(noon - 3600, noon, 'en', t)).toBe('day.today');
    expect(dayLabel(noon - 86400, noon, 'en', t)).toBe('day.yesterday');
    expect(dayLabel(noon - 3 * 86400, noon, 'en', t)).toBe('March 18');
  });
  it('names the year when it is not this year', () => {
    expect(dayLabel(noon - 400 * 86400, noon, 'en', t)).toMatch(/2026/);
  });
});

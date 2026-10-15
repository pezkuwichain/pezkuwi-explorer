const INTL: Record<string, string> = { kmr: 'ku', ckb: 'ckb', tr: 'tr', en: 'en', fa: 'fa', ar: 'ar' };
export const intlTag = (locale: string) => INTL[locale] ?? 'en';

// Text returned by the translator for ckb relative time (ICU has no ckb relative-time data).
export type RelativeTimeKey = 'time.minutesAgo' | 'time.hoursAgo' | 'time.daysAgo';
export type Translate = (key: RelativeTimeKey, opts: { count: number }) => string;

const numberFormats = new Map<string, Intl.NumberFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

function numberFormat(locale: string): Intl.NumberFormat {
  const tag = INTL[locale] ?? 'en';
  let nf = numberFormats.get(tag);
  if (!nf) {
    nf = new Intl.NumberFormat(tag, { useGrouping: true });
    numberFormats.set(tag, nf);
  }
  return nf;
}

function relativeFormat(locale: string): Intl.RelativeTimeFormat {
  const tag = INTL[locale] ?? 'en';
  let rtf = relativeFormats.get(tag);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    relativeFormats.set(tag, rtf);
  }
  return rtf;
}

export function formatInteger(value: bigint, locale: string): string {
  return numberFormat(locale).format(value);
}

// What people read: at most 4 fractional digits once the whole part is non-zero. Digits are cut, never
// rounded, and a figure that lost digits is marked "≈" so it is never mistaken for the exact amount.
export function formatAmount(value: bigint, decimals: number, symbol: string, locale: string): string {
  return `${formatUnits(value, decimals, locale, false)} ${symbol}`;
}

// Every digit, no "≈": for titles and anywhere the exact amount must be readable.
export function formatExact(value: bigint, decimals: number, symbol: string, locale: string): string {
  return `${formatUnits(value, decimals, locale, true)} ${symbol}`;
}

// The number part of formatAmount.
export const formatNumber = (value: bigint, decimals: number, locale: string) => formatUnits(value, decimals, locale, false);
function formatUnits(value: bigint, decimals: number, locale: string, exact: boolean): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  const cut = !exact && whole > 0n && frac.length > 4;
  if (cut) frac = frac.slice(0, 4).replace(/0+$/, '');
  const nf = numberFormat(locale);
  const sep = nf.formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  // Localise fraction digits with the same formatter as the whole part (truncation, not rounding, keeps exactness).
  const localFrac = frac.replace(/[0-9]/g, (d) => nf.format(BigInt(d)));
  const wholeText = nf.format(whole);
  return `${cut ? '≈' : ''}${neg ? '-' : ''}${wholeText}${localFrac ? sep + localFrac : ''}`;
}

// A short figure for big totals (40.2M): the locale's own scale words and digits, at most one fractional digit.
// The value is cut to that precision in bigint before Intl sees it, so no runtime (with or without
// roundingMode) can round it up; "≈" marks a cut figure. Below a thousand it is formatAmount's number.
export function formatCompact(value: bigint, decimals: number, locale: string): string {
  const base = 10n ** BigInt(decimals);
  const abs = value < 0n ? -value : value;
  const whole = abs / base;
  if (whole < 1000n) return formatUnits(value, decimals, locale, false);
  const digits = whole.toString().length;
  // Thousands scale: 1–3 digits before the scale word, plus the one fractional digit shown.
  const shown = ((digits - 1) % 3) + 2;
  const step = 10n ** BigInt(digits - shown);
  const kept = whole - (whole % step);
  const cut = kept !== whole || abs % base !== 0n;
  const nf = new Intl.NumberFormat(intlTag(locale), { notation: 'compact', maximumFractionDigits: 1, roundingMode: 'trunc' });
  // kept has at most four significant digits, so a Number holds it exactly.
  return `${cut ? '≈' : ''}${nf.format(value < 0n ? -Number(kept) : Number(kept))}`;
}

export function relativeTime(unixSeconds: number, now: number, locale: string, t?: Translate): string {
  if (!Number.isFinite(unixSeconds) || !Number.isFinite(now)) return '';
  const d = unixSeconds - now;
  const abs = Math.abs(d);
  // ICU has no ckb relative-time data, and some runtimes (Chrome's trimmed ICU) have none for Kurmanji either:
  // the locale's own keys then say it, instead of the runtime falling back to English.
  const fromKeys = locale === 'ckb' || Intl.RelativeTimeFormat.supportedLocalesOf(intlTag(locale)).length === 0;
  if (fromKeys && t && d <= 0) {
    if (abs < 3600) return t('time.minutesAgo', { count: Math.round(abs / 60) });
    if (abs < 86400) return t('time.hoursAgo', { count: Math.round(abs / 3600) });
    return t('time.daysAgo', { count: Math.round(abs / 86400) });
  }
  const rtf = relativeFormat(locale);
  if (abs < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  return rtf.format(Math.round(d / 86400), 'day');
}

export function formatPercent(whole: number, locale: string): string {
  return new Intl.NumberFormat(intlTag(locale), { style: 'percent', maximumFractionDigits: 0 }).format(whole / 100);
}

// Local calendar day of a unix time, for grouping a list of activity under day headers.
export function dayKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export type DayTranslate = (key: 'day.today' | 'day.yesterday') => string;
export function dayLabel(unixSeconds: number, now: number, locale: string, t: DayTranslate): string {
  if (dayKey(unixSeconds) === dayKey(now)) return t('day.today');
  const y = new Date(now * 1000);
  y.setDate(y.getDate() - 1);
  if (dayKey(unixSeconds) === dayKey(y.getTime() / 1000)) return t('day.yesterday');
  const d = new Date(unixSeconds * 1000);
  const sameYear = d.getFullYear() === new Date(now * 1000).getFullYear();
  return d.toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

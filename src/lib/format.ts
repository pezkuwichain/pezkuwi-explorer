const INTL: Record<string, string> = { kmr: 'ku', ckb: 'ckb', tr: 'tr', en: 'en', fa: 'fa', ar: 'ar' };

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

export function formatAmount(value: bigint, decimals: number, symbol: string, locale: string): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  if (whole > 0n && frac.length > 4) frac = frac.slice(0, 4).replace(/0+$/, '');
  const nf = numberFormat(locale);
  const sep = nf.formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  // Localise fraction digits with the same formatter as the whole part (truncation, not rounding, keeps exactness).
  const localFrac = frac.replace(/[0-9]/g, (d) => nf.format(BigInt(d)));
  const wholeText = nf.format(whole);
  return `${neg ? '-' : ''}${wholeText}${localFrac ? sep + localFrac : ''} ${symbol}`;
}

export function relativeTime(unixSeconds: number, now: number, locale: string, t?: Translate): string {
  if (!Number.isFinite(unixSeconds) || !Number.isFinite(now)) return '';
  const d = unixSeconds - now;
  const abs = Math.abs(d);
  if (locale === 'ckb' && t && d <= 0) {
    if (abs < 3600) return t('time.minutesAgo', { count: Math.round(abs / 60) });
    if (abs < 86400) return t('time.hoursAgo', { count: Math.round(abs / 3600) });
    return t('time.daysAgo', { count: Math.round(abs / 86400) });
  }
  const rtf = relativeFormat(locale);
  if (abs < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  return rtf.format(Math.round(d / 86400), 'day');
}

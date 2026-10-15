const INTL: Record<string, string> = { kmr: 'ku', ckb: 'ckb', tr: 'tr', en: 'en', fa: 'fa', ar: 'ar' };

export function formatAmount(value: bigint, decimals: number, symbol: string, locale: string): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  if (whole > 0n && frac.length > 4) frac = frac.slice(0, 4).replace(/0+$/, '');
  const nf = new Intl.NumberFormat(INTL[locale] ?? 'en', { useGrouping: true });
  const sep = nf.formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  const wholeText = nf.format(whole);
  return `${neg ? '-' : ''}${wholeText}${frac ? sep + frac : ''} ${symbol}`;
}

export function relativeTime(unixSeconds: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(INTL[locale] ?? 'en', { numeric: 'auto' });
  const d = unixSeconds - now;
  const abs = Math.abs(d);
  if (abs < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  return rtf.format(Math.round(d / 86400), 'day');
}

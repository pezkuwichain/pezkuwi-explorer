// Parses what a person typed into a token amount in its smallest unit. Accepts "." or "," as the decimal mark.
// Returns null for anything that is not a plain non-negative decimal number, or that has more fractional digits
// than the token has (never rounded: an amount that cannot be sent exactly is rejected).
export function parseAmount(text: string, decimals: number): bigint | null {
  const s = text.trim().replace(',', '.');
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const whole = m[1] ?? '';
  const frac = m[2] ?? '';
  if (!whole && !frac) return null;
  if (frac.length > decimals) return null;
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

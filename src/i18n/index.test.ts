import { describe, expect, it } from 'vitest';
import { LOCALES, isRtl } from './index';
import kmr from './locales/kmr.json';

describe('i18n', () => {
  it('defaults to Kurmanci and lists six locales', async () => {
    const { default: i18n } = await import('./index');
    expect(i18n.language).toBe('kmr');
    expect(LOCALES).toEqual(['kmr', 'ckb', 'tr', 'en', 'fa', 'ar']);
  });
  it('marks ckb, fa, ar as right-to-left', () => {
    expect(['ckb', 'fa', 'ar'].every(isRtl)).toBe(true);
    expect(['kmr', 'tr', 'en'].some(isRtl)).toBe(false);
  });
  it('every locale has exactly the keys of kmr', async () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    for (const l of LOCALES) {
      const m = (await import(`./locales/${l}.json`)).default;
      expect(keys(m).sort()).toEqual(keys(kmr).sort());
    }
  });
  it('no locale uses technical vocabulary', async () => {
    const banned = /\b(block|extrinsic|hash|pallet|era|nonce)\b/i;
    for (const l of LOCALES) {
      const text = JSON.stringify((await import(`./locales/${l}.json`)).default);
      expect(text).not.toMatch(banned);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Kurmancî spelling settled against the Ferheng (Zeynelabidin): "cuzdan" is masculine ("Xelîtk: Cuzdanê ku pere
// dixin navê"), so its ezafe and oblique are "cuzdanê"; "berîk" there means a pocket, not a wallet.
describe('kmr spelling', () => {
  const kmr = readFileSync('src/i18n/locales/kmr.json', 'utf8');
  it('writes cuzdan with the masculine ending', () => {
    expect(kmr).toMatch(/cuzdanê/i);
    expect(kmr).not.toMatch(/cuzdana/i);
  });
  it('does not call the wallet berîk', () => {
    expect(kmr).not.toMatch(/berîk/i);
  });
});

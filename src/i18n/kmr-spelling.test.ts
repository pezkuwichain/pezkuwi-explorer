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
  // Owner decision (Serok, 2026-10-16): citizenship is "welatîbûn" and a citizen "welatî" everywhere in the explorer.
  // The Ferheng gives Hemwelatî = compatriot, which is not citizenship.
  it('never uses hemwelatî', () => {
    expect(kmr).not.toMatch(/hemwelat/i);
  });
  // Owner decision (Serok, 2026-10-17): the bottom tab is "Hevwelatî" and the directorate is "… Karên Gelhe û
  // Hevwelatiyan"; the citizenship screen, the home tile and the i-Wallet keep "Welatîbûn" / "Welatî".
  it('names the citizenship tab Hevwelatî and nothing else changes with it', () => {
    const j = JSON.parse(kmr) as { tab: { citizenship: string }; home: { citizenship: string }; citizenship: { title: string; directorate: string }; iwallet: unknown };
    expect(j.tab.citizenship).toBe('Hevwelatî');
    expect(j.citizenship.directorate).toBe('Rêveberiya Giştî ya Karên Gelhe û Hevwelatiyan');
    expect(j.home.citizenship).toBe('Welatîbûn');
    expect(j.citizenship.title).toBe('Welatîbûn');
    expect(JSON.stringify(j.iwallet)).not.toMatch(/hevwelat/i);
  });
  // One term per concept in the i-Wallet texts (glossary in docs/i18n-review.md): the password is "şîfre" (pwap),
  // the backup words are "peyvên vegerandinê", citizenship is "welatîbûn" (pwap newCitizen.*).
  it('keeps the i-Wallet glossary terms', () => {
    const iwallet = JSON.stringify((JSON.parse(kmr) as { iwallet: unknown }).iwallet);
    for (const variant of [/pasword/i, /yedek/i, /hemwelatîbûn/i, /welatîtî/i]) expect(iwallet).not.toMatch(variant);
  });
});

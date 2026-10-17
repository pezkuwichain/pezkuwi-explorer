import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LOCALES, setLanguage } from '../i18n';
import { LEGAL, legalDoc, type LegalKind } from '.';
import LegalPage from './LegalPage';
import { CONTACT, linkify } from './linkify';
import type { LegalDoc } from './types';

const KINDS: LegalKind[] = ['privacy', 'terms'];
const page = (kind: LegalKind) => render(<MemoryRouter initialEntries={[`/${kind}`]}><LegalPage kind={kind} /></MemoryRouter>);
const text = (d: LegalDoc) => JSON.stringify(d);

describe('privacy and terms pages', () => {
  afterEach(() => setLanguage('kmr'));

  it('has its own module for every language, none of them the English fallback', () => {
    for (const kind of KINDS) {
      for (const lang of LOCALES) {
        expect(LEGAL[kind][lang], `${kind}.${lang}`).toBeDefined();
        if (lang !== 'en') expect(legalDoc(kind, lang)).not.toBe(LEGAL[kind].en);
      }
    }
  });

  it('falls back to English only for a language without a module', () => {
    expect(legalDoc('privacy', 'xx')).toBe(LEGAL.privacy.en);
    expect(legalDoc('terms', 'xx')).toBe(LEGAL.terms.en);
  });

  it('every translation has the shape of the English text: same sections, same paragraphs and list items', () => {
    const shape = (d: LegalDoc) => [d.intro.length, ...d.sections.map((s) => s.blocks.map((b) => ('p' in b ? 'p' : b.ul.length)).join(','))];
    for (const kind of KINDS) {
      for (const lang of LOCALES) expect(shape(legalDoc(kind, lang)), `${kind}.${lang}`).toEqual(shape(LEGAL[kind].en!));
    }
  });

  for (const lang of LOCALES) {
    for (const kind of KINDS) {
      it(`${kind} renders in ${lang} with the contact address, the Zagros test network and no genesis reset`, () => {
        setLanguage(lang);
        const doc = legalDoc(kind, lang);
        const { container } = page(kind);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(doc.title);
        expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(doc.sections.map((s) => s.heading));
        expect(screen.getByText(doc.updated)).toBeInTheDocument();
        // The contact is a mailto link, its address kept left to right.
        const mail = screen.getAllByRole('link', { name: CONTACT });
        expect(mail.length).toBeGreaterThan(0);
        for (const a of mail) {
          expect(a).toHaveAttribute('href', `mailto:${CONTACT}`);
          expect(a.querySelector('bdi')).toHaveAttribute('dir', 'ltr');
        }
        // The general policy on pezkuwichain.io opens in a new tab.
        const general = screen.getByRole('link', { name: `pezkuwichain.io/en/${kind}` });
        expect(general).toHaveAttribute('href', `https://pezkuwichain.io/en/${kind}`);
        expect(general).toHaveAttribute('target', '_blank');
        expect(general).toHaveAttribute('rel', 'noopener');
        // Zagros is named as the test network: the terms' clause 4, and the privacy notice's test nodes.
        const body = container.textContent ?? '';
        expect(body).toContain('Zagros');
        if (kind === 'terms') {
          const clause = screen.getAllByRole('heading', { level: 2 })[3]!.closest('section')!;
          expect(within(clause).getByText(/Zagros/)).toBeInTheDocument();
        }
        // Owner decision (Serok, 2026-10-17): the genesis-reset clause was removed; nothing may refer to one.
        expect(body).not.toMatch(/genesis/i);
        expect(body).not.toMatch(/genesis'/i);
        expect(text(doc)).not.toMatch(/genesis|جێنێسیس|جنسیس|التكوين/i);
        expect(document.documentElement.dir).toBe(['ckb', 'fa', 'ar'].includes(lang) ? 'rtl' : 'ltr');
      });
    }
  }

  it('renders right to left in Sorani with headings, lists and the host names kept left to right', () => {
    setLanguage('ckb');
    const { container } = page('privacy');
    expect(document.documentElement.dir).toBe('rtl');
    expect(container.querySelectorAll('ul li').length).toBe(6);
    const hosts = [...container.querySelectorAll('bdi[dir="ltr"]')].map((b) => b.textContent);
    expect(hosts).toEqual(expect.arrayContaining(['explorer.pezkuwichain.io', 'cuzdan.pex.network', 'subquery.pezkuwichain.io']));
  });

  // The Kurmancî rules of docs/i18n-review.md hold in the long text too: citizenship is welatîbûn, a citizen welatî,
  // the wallet "cuzdan" is masculine.
  it('keeps the Kurmancî glossary in the kmr modules', () => {
    for (const kind of KINDS) {
      const kmr = text(legalDoc(kind, 'kmr'));
      expect(kmr).not.toMatch(/hemwelat|hevwelat/i);
      expect(kmr).not.toMatch(/cuzdana|berîk|yedek/i);
      expect(kmr).not.toMatch(/gelê kurd/i);
    }
    expect(text(legalDoc('privacy', 'kmr'))).toMatch(/welatîbûnê/);
  });

  it('links only the known addresses', () => {
    const { container } = render(<p>{linkify('Write to privacy@pezkuwichain.io or see pezkuwichain.io/en/terms; example.com is plain.')}</p>);
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['mailto:privacy@pezkuwichain.io', 'https://pezkuwichain.io/en/terms']);
    expect(container.textContent).toBe('Write to privacy@pezkuwichain.io or see pezkuwichain.io/en/terms; example.com is plain.');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LOCALES, setLanguage } from '../i18n';
import i18n from '../i18n';
import Layout from './Layout';
import { SOCIAL } from './social';

const at = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route element={<Layout />}><Route path="*" element={<p>SCREEN</p>} /></Route></Routes></MemoryRouter>,
);

const EXPECTED = [
  ['YouTube', 'https://www.youtube.com/@dijitalkurdistan'],
  ['X', 'https://x.com/KuwiPez'],
  ['Instagram', 'https://www.instagram.com/pezkuwichaindks'],
  ['Facebook', 'https://www.facebook.com/1341558285712626'],
  ['Telegram', 'https://t.me/kurdishmedya'],
];

describe('site footer', () => {
  afterEach(() => setLanguage('kmr'));

  it('is on every explorer screen, with the experts link, the two legal pages and the five social accounts', () => {
    setLanguage('en');
    for (const path of ['/', '/account', '/account/open', '/payment', '/citizenship', '/network', '/privacy', '/terms']) {
      const { unmount } = at(path);
      const foot = screen.getByRole('contentinfo');
      expect(within(foot).getByRole('link', { name: /For experts/ })).toHaveAttribute('href', 'https://apps.pezkuwichain.io');
      const legal = within(foot).getByRole('navigation', { name: 'Privacy and terms' });
      expect(within(legal).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
      expect(within(legal).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
      const social = within(within(foot).getByRole('list', { name: 'Social media' })).getAllByRole('link');
      expect(social.map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')])).toEqual(EXPECTED);
      for (const a of social) {
        expect(a).toHaveAttribute('target', '_blank');
        expect(a).toHaveAttribute('rel', 'noopener noreferrer');
        expect(a).not.toHaveAttribute('title');
        // The icon is inline (no remote image) and hidden from assistive tech; the link's name is the aria-label.
        expect(a.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(a.querySelector('img')).toBeNull();
      }
      // The footer sits before the fixed tab bar, inside the page that pads itself by the tab bar's height.
      expect(foot.compareDocumentPosition(screen.getByRole('navigation', { name: 'Sections' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      unmount();
    }
  });

  it('is not under the i-Wallet screens (its landing places the footer itself)', () => {
    for (const path of ['/i-wallet', '/i-wallet/send', '/i-wallet/create', '/i-wallet/citizen', '/i-wallet/settings']) {
      const { unmount } = at(path);
      expect(screen.queryByRole('contentinfo')).toBeNull();
      unmount();
    }
  });

  it('names the legal links in all six languages', () => {
    const want: Record<string, [string, string]> = {
      kmr: ['Nepenîtî', 'Şertên bikaranînê'], ckb: ['تایبەتێتی', 'مەرجەکان'], tr: ['Gizlilik', 'Koşullar'],
      en: ['Privacy', 'Terms'], fa: ['حریم خصوصی', 'شرایط'], ar: ['الخصوصية', 'الشروط'],
    };
    for (const lang of LOCALES) {
      setLanguage(lang);
      const { unmount } = at('/');
      const legal = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: i18n.t('legal.footer') });
      expect(within(legal).getAllByRole('link').map((a) => a.textContent)).toEqual(want[lang]);
      expect(within(screen.getByRole('contentinfo')).getAllByRole('link', { name: /YouTube|^X$|Instagram|Facebook|Telegram/ })).toHaveLength(SOCIAL.length);
      unmount();
    }
  });

  it('renders right to left in Arabic with the same links', () => {
    setLanguage('ar');
    at('/network');
    expect(document.documentElement.dir).toBe('rtl');
    const foot = screen.getByRole('contentinfo');
    expect(within(foot).getByRole('link', { name: 'الخصوصية' })).toHaveAttribute('href', '/privacy');
    expect(within(foot).getByRole('link', { name: 'Telegram' })).toHaveAttribute('href', 'https://t.me/kurdishmedya');
  });
});

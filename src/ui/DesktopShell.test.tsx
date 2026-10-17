import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setLanguage } from '../i18n';
import Layout from './Layout';

const at = (desktop: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({
  matches: desktop && q.includes('min-width: 900px'), media: q, addEventListener() {}, removeEventListener() {},
}));
const ui = () => render(<MemoryRouter initialEntries={['/']}><Routes><Route element={<Layout />}><Route index element={<p>HOME</p>} /></Route></Routes></MemoryRouter>);
afterEach(() => { vi.unstubAllGlobals(); setLanguage('kmr'); });

describe('desktop layout', () => {
  it('at 900px and wider: the app sits in a phone frame, with the header and six lazy mascots around it', () => {
    setLanguage('en'); at(true);
    ui();
    const frame = document.querySelector('.phone-screen');
    expect(frame).not.toBeNull();
    expect(frame!.querySelector('.page')).not.toBeNull();
    expect(frame!.querySelector('.tabbar')).not.toBeNull();
    expect(screen.getByText('Pezkuwi Explorer')).toBeInTheDocument();
    const imgs = [...document.querySelectorAll('.mascot img')] as HTMLImageElement[];
    expect(imgs).toHaveLength(6);
    for (const img of imgs) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('src')).toMatch(/^\/mascots\/pez[2-7]\.jpg$/);
      expect(img.alt.length).toBeGreaterThan(5);
    }
    expect(imgs.map((i) => i.getAttribute('src'))).not.toContain('/mascots/pez1.jpg');
    expect(screen.getByText('Hi! I’m Pezkuwi.')).toBeInTheDocument();
  });
  it('below 900px: no frame, no mascots, nothing extra is loaded', () => {
    setLanguage('en'); at(false);
    ui();
    expect(document.querySelector('.phone-screen')).toBeNull();
    expect(document.querySelectorAll('img[src^="/mascots/"]')).toHaveLength(0);
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });
});

// Owner decision (Serok, 2026-10-17, 09:16): the mascot is "Pezkuwi", never the old placeholder "Pez".
describe('the mascot name', () => {
  it('is Pezkuwi in every locale and no mascot text still says Pez alone', async () => {
    const hello = { kmr: 'Silav! Ez Pezkuwi me.', en: 'Hi! I’m Pezkuwi.', tr: "Merhaba! Ben Pezkuwi'yim." } as const;
    for (const lang of ['kmr', 'ckb', 'fa', 'ar', 'tr', 'en'] as const) {
      const mascot = (await import(`../i18n/locales/${lang}.json`)).default.mascot as Record<string, string>;
      if (lang in hello) expect(mascot.hello).toBe(hello[lang as keyof typeof hello]);
      for (const [k, v] of Object.entries(mascot)) {
        expect(`${lang}.${k}: ${v.replace(/Pezkuwi/g, '')}`).not.toMatch(/\bPez\b|پێز|(^|\s)پز|بيز/);
        if (k === 'hello' || /^alt/.test(k)) expect(v).toContain('Pezkuwi');
      }
    }
  });
});

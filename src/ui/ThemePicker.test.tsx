import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setLanguage } from '../i18n';
import ThemePicker from './ThemePicker';
import { startTheme } from './theme';

const KEY = 'pezkuwi-explorer:theme';
let systemLight = false;
const mqListeners = new Set<() => void>();

beforeEach(() => {
  setLanguage('en');
  localStorage.clear();
  systemLight = false;
  mqListeners.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() { return q.includes('light') ? systemLight : false; },
    media: q,
    addEventListener: (_: string, l: () => void) => mqListeners.add(l),
    removeEventListener: (_: string, l: () => void) => mqListeners.delete(l),
  }));
  document.head.innerHTML = '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#08090E">'
    + '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F5EF">';
});
afterEach(() => { vi.unstubAllGlobals(); setLanguage('kmr'); });

const theme = () => document.documentElement.getAttribute('data-theme');
const bars = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'));
const pick = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: /^Theme:/ }));
  fireEvent.click(screen.getByRole('menuitemradio', { name }));
};

describe('theme switch', () => {
  it('starts on Auto and follows the system while on Auto', () => {
    startTheme();
    render(<ThemePicker />);
    expect(theme()).toBe('dark');
    expect(screen.getByRole('button', { name: 'Theme: Auto' })).toBeInTheDocument();
    systemLight = true;
    act(() => mqListeners.forEach((l) => l()));
    expect(theme()).toBe('light');
  });

  it('a chosen theme wins over the system, is stored, and survives a system change', () => {
    startTheme();
    render(<ThemePicker />);
    pick('Light');
    expect(theme()).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Theme: Light' })).toBeInTheDocument();
    // After a choice both bar colours take the chosen theme's colour.
    expect(bars()).toEqual(['#F4F5EF', '#F4F5EF']);
    act(() => mqListeners.forEach((l) => l()));
    expect(theme()).toBe('light');
  });

  it('Auto forgets the choice and goes back to the system', () => {
    localStorage.setItem(KEY, 'light');
    startTheme();
    render(<ThemePicker />);
    expect(theme()).toBe('light');
    pick('Auto');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(theme()).toBe('dark');
    expect(bars()).toEqual(['#08090E', '#F4F5EF']);
  });

  it('marks the current mode in the menu and closes on Escape, returning focus', () => {
    localStorage.setItem(KEY, 'dark');
    startTheme();
    render(<ThemePicker />);
    const button = screen.getByRole('button', { name: 'Theme: Dark' });
    fireEvent.click(button);
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Auto' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('a choice made in another tab is applied here', () => {
    startTheme();
    render(<ThemePicker />);
    localStorage.setItem(KEY, 'light');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: KEY })); });
    expect(theme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Theme: Light' })).toBeInTheDocument();
  });
});

describe('the boot script', () => {
  const boot = () => new Function(readFileSync('public/theme-boot.js', 'utf8'))();

  it('applies the stored choice, else the system, before the app loads', () => {
    boot();
    expect(theme()).toBe('dark');
    systemLight = true;
    boot();
    expect(theme()).toBe('light');
    localStorage.setItem(KEY, 'dark');
    boot();
    expect(theme()).toBe('dark');
    expect(bars()).toEqual(['#08090E', '#08090E']);
  });

  it('is loaded by index.html as a blocking script, after the theme-color metas', () => {
    const html = readFileSync('index.html', 'utf8');
    const tag = html.indexOf('<script src="/theme-boot.js"></script>');
    expect(tag).toBeGreaterThan(html.lastIndexOf('name="theme-color"'));
    expect(tag).toBeLessThan(html.indexOf('type="module"'));
  });
});

describe('stylesheets', () => {
  // A colour-scheme media query would apply the system's theme whatever the reader chose.
  it('no stylesheet keys colours on prefers-color-scheme', () => {
    const css = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? css(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []);
    for (const f of css('src')) expect(readFileSync(f, 'utf8'), f).not.toMatch(/prefers-color-scheme/);
  });
});

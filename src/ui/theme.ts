import { PREFIX, storage } from '../lib/storage';

// Ported from dks.news (site/news.js, "Theme (auto / light / dark)"). Three choices, not a toggle: a toggle
// could only ever store a theme, so a reader who touched it once stopped following their system for good.
// Auto is the absence of a stored value. /theme-boot.js sets html[data-theme] before first paint with the
// same key; this module keeps it in step afterwards (system changes on Auto, other tabs, the switch).
export type ThemeMode = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark'];
const KEY = 'theme';
// The browser's own bar takes the page background (index.html carries one meta per system scheme).
const BAR: Record<Theme, string> = { light: '#F4F5EF', dark: '#08090E' };

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const lightQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null);
export function storedMode(): ThemeMode {
  const t = storage.get(KEY);
  return t === 'light' || t === 'dark' ? t : 'auto';
}
export const systemTheme = (): Theme => (lightQuery()?.matches ? 'light' : 'dark');
export const currentTheme = (): Theme => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
const resolve = (m: ThemeMode): Theme => (m === 'auto' ? systemTheme() : m);

function paintBar(t: Theme) {
  const auto = storedMode() === 'auto';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('media') ?? '';
    const own: Theme | null = /light/.test(media) ? 'light' : /dark/.test(media) ? 'dark' : null;
    m.setAttribute('content', own && auto ? BAR[own] : BAR[t]);
  });
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== t) {
    root.classList.add('theme-switching');
    root.setAttribute('data-theme', t);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  }
  paintBar(t);
  notify();
}

// Store the choice and show it. The new theme spreads out from `origin` as a circle; a browser without view
// transitions, a reader who asked for less motion, or a choice that does not change the colours gets it at once.
export function chooseTheme(m: ThemeMode, origin?: Element | null) {
  if (m === 'auto') storage.remove(KEY);
  else storage.set(KEY, m);
  const next = resolve(m);
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || !origin || reduce || next === currentTheme()) return applyTheme(next);
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  doc.startViewTransition(() => applyTheme(next)).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

export function subscribeTheme(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Called once at start-up: covers a page whose boot script did not run, follows the system while on Auto,
// and keeps open tabs in step.
export function startTheme() {
  applyTheme(resolve(storedMode()));
  lightQuery()?.addEventListener('change', () => { if (storedMode() === 'auto') applyTheme(systemTheme()); });
  window.addEventListener('storage', (e) => { if (e.key === PREFIX + KEY || e.key === null) applyTheme(resolve(storedMode())); });
}

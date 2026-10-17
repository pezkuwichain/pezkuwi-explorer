import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

describe('build output', () => {
  it('emits a standalone manifest and a service worker, and keeps the i-Wallet out of the main chunk', () => {
    execSync('npx vite build', { stdio: 'ignore' });
    const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
    expect(m).toMatchObject({ start_url: '/', display: 'standalone', theme_color: '#08090E', background_color: '#08090E' });
    const sw = readFileSync('dist/sw.js', 'utf8');
    expect(sw.length).toBeGreaterThan(0);

    // The i-Wallet loads on demand (src/iwallet/LazyRoutes.tsx) so the main chunk stays under the precache limit. The
    // real property is in the build: the entry chunk named by index.html holds none of the wallet's key code. Markers
    // (strings that survive minification): the keystore's error class names, a keyring error message, a Face ID key.
    const entry = /<script[^>]+src="\/(assets\/index-[^"]+\.js)"/.exec(readFileSync('dist/index.html', 'utf8'))?.[1];
    expect(entry).toBeDefined();
    const main = readFileSync(`dist/${entry}`, 'utf8');
    const MARKERS = ['StorageUnavailableError', 'CorruptKeystoreError', 'Unable to match provided value to a secret URI', 'faceid-unsupported'];
    expect(MARKERS.filter((k) => main.includes(k))).toEqual([]);
    // The markers do exist in the build (else this check could never fail), in the lazy chunks …
    const lazy = readdirSync('dist/assets').filter((f) => f.endsWith('.js') && `assets/${f}` !== entry)
      .map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
    expect(MARKERS.filter((k) => !lazy.includes(k))).toEqual([]);
    // … and those chunks are precached, so the wallet still opens offline.
    expect(sw).toMatch(/IWalletTree-[\w-]+\.js/);
    expect(sw).toMatch(/keystore-[\w-]+\.js/);
    expect(sw).toMatch(/faceid-[\w-]+\.js/);
  }, 240_000);
});

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('build output', () => {
  it('emits a standalone manifest and a service worker', () => {
    execSync('npx vite build', { stdio: 'ignore' });
    const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
    expect(m).toMatchObject({ start_url: '/', display: 'standalone', theme_color: '#08090E', background_color: '#08090E' });
    expect(readFileSync('dist/sw.js', 'utf8').length).toBeGreaterThan(0);
  }, 240_000);
});

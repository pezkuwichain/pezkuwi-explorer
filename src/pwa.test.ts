import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('build output', () => {
  it('emits a standalone manifest and a service worker', () => {
    // As shipped: vitest sets NODE_ENV=test, which a child build would inherit (development React, a larger bundle
    // than the service worker precaches), so the build is run with the production environment it ships with.
    execSync('npx vite build', { stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production' } });
    const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
    expect(m).toMatchObject({ start_url: '/', display: 'standalone', theme_color: '#08090E', background_color: '#08090E' });
    expect(readFileSync('dist/sw.js', 'utf8').length).toBeGreaterThan(0);
  }, 240_000);
});

import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  // The visual pass has its own config and build (playwright.screens.config.ts).
  testIgnore: 'screens.spec.ts',
  timeout: 60_000,
  // One worker: every test opens its own RPC sockets, and a burst of parallel connects from one IP is what flakes.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  // Tests run against a served build; a remote BASE_URL needs no local server.
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npx vite preview --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } } },
    // WebKit stands in for Safari, the browser the i-Wallet exists for: IndexedDB and the crypto WASM under the CSP.
    { name: 'webkit', testMatch: 'iwallet.spec.ts', use: { browserName: 'webkit' } },
  ],
});

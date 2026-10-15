import { defineConfig } from '@playwright/test';

// The visual pass (npm run screens): every screen at 390×844 in the dark and light themes, written to
// test-results/screens/ for comparison with the approved mockup. Not committed, not a pixel gate.
// It serves its own build (e2e/screens.vite.config.ts) in which history is switched on.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'screens.spec.ts',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4174', serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  webServer: {
    command: 'npx vite build --config e2e/screens.vite.config.ts && npx vite preview --config e2e/screens.vite.config.ts --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 240_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } } }],
});

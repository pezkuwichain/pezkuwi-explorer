/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Chain data is never cached: only the app shell is precached, no runtime caching at all.
      workbox: {
        navigateFallback: '/index.html',
        // Self-hosted fonts are part of the shell so it renders offline with the right type.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
      },
      manifest: {
        name: 'Pezkuwi Explorer',
        short_name: 'Explorer',
        start_url: '/',
        display: 'standalone',
        // The Pezkuwi navy of the dark theme; the icons are the Newroz flame on the same navy.
        background_color: '#08090E',
        theme_color: '#08090E',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { exclude: ['e2e/**', 'node_modules/**'], environment: 'happy-dom', setupFiles: ['./src/test-setup.ts'] },
});

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
      workbox: { navigateFallback: '/index.html', runtimeCaching: [] },
      manifest: {
        name: 'Pezkuwi Explorer',
        short_name: 'Explorer',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#14a05a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'happy-dom', setupFiles: ['./src/test-setup.ts'] },
});

import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

// Visual pass only (playwright.screens.config.ts): the shipped config, built into its own folder. History has been
// switched on in src/config/network.ts since the indexer caught up (2026-10-15), so this build needs no override any
// more; the spec answers the indexer from fixtures. Never deployed.
export default mergeConfig(base, defineConfig({ build: { outDir: 'dist-screens' } }));

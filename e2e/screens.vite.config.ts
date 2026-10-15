import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from '../vite.config.ts';

// Visual pass only (playwright.screens.config.ts): the shipped config keeps history off, so the payment
// verdict and the activity list could never be seen. This build switches history on exactly as the owner
// will (history.assetHub = ZAGROS_HISTORY_URL); the spec answers the indexer from fixtures. Never deployed.
const historyOn: Plugin = {
  name: 'screens-history-on',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/config/network.ts')) return null;
    const out = code.replace('history: { assetHub: null, relay: null }', 'history: { assetHub: ZAGROS_HISTORY_URL, relay: null }');
    if (out === code) throw new Error('screens build: history switch not found in src/config/network.ts');
    return out;
  },
};

export default mergeConfig(base, defineConfig({ plugins: [historyOn], build: { outDir: 'dist-screens' } }));

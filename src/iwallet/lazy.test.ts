// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The i-Wallet loads on demand (App.tsx → iwallet/LazyRoutes.tsx → IWalletTree.tsx), so the explorer's main bundle stays under the
// service worker's 2 MiB precache limit (src/pwa.test.ts). That holds only while the always-loaded files never import
// the wallet's screens, keyring, crypto or Face ID code statically. A static import (not `import type`, not import())
// of any of these from those files would pull the whole wallet back into the main chunk.
const staticImports = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]!);

const HEAVY = [/\/keystore$/, /\/faceid$/, /\/citizen$/, /\/IWalletTree$/, /\/screens\//, /\/IWalletRoutes$/, /^@pezkuwi\/keyring/, /\/saveWallet$/, /\/tx$/];

describe('i-Wallet code stays out of the main bundle', () => {
  it('App imports only the lazy routes and the light provider from the i-Wallet', () => {
    const iw = staticImports('src/App.tsx').filter((s) => s.includes('/iwallet/'));
    expect(iw.sort()).toEqual(['./iwallet/IWalletContext', './iwallet/LazyRoutes']);
  });

  for (const file of ['src/iwallet/IWalletContext.tsx', 'src/iwallet/LazyRoutes.tsx', 'src/iwallet/IWalletLoading.tsx',
    'src/iwallet/personal-store.ts', 'src/iwallet/progress.ts', 'src/iwallet/idb.ts']) {
    it(`${file} imports nothing heavy statically`, () => {
      const heavy = staticImports(file).filter((s) => HEAVY.some((h) => h.test(s)));
      expect(heavy).toEqual([]);
    });
  }
});

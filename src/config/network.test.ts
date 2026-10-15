import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NETWORK, caip2 } from './network';

describe('network config', () => {
  it('builds CAIP-2 ids from the first 16 genesis bytes', () => {
    expect(caip2('relay')).toBe('polkadot:1b0b4727bbb5e44ed587d1056b4ad537');
  });
  it('uses only wss endpoints', () => {
    for (const c of Object.values(NETWORK.chains)) for (const u of c.rpc) expect(u.startsWith('wss://')).toBe(true);
  });
  it('lists PEZ, wUSDT, wHEZ with measured decimals', () => {
    expect(NETWORK.assets).toEqual([
      { id: 1, symbol: 'PEZ', decimals: 12 },
      { id: 1000, symbol: 'wUSDT', decimals: 6 },
      { id: 2, symbol: 'wHEZ', decimals: 12 },
    ]);
  });
  // CSP_CONF lets the checks be pointed at a deliberately broken copy to prove they can fail.
  const conf = () => readFileSync(process.env.CSP_CONF ?? 'deploy/nginx-explorer.conf', 'utf8');

  it('every configured origin is a token of the deployed connect-src', () => {
    const line = conf().split('\n').find((l) => /^\s*add_header\s+Content-Security-Policy\b/.test(l));
    expect(line).toBeDefined();
    const directive = line!.split(';').map((d) => d.trim().replace(/^.*?"/, '')).find((d) => d.startsWith('connect-src '));
    expect(directive).toBeDefined();
    const tokens = new Set(directive!.split(/\s+/).slice(1));
    for (const c of Object.values(NETWORK.chains)) for (const u of c.rpc) expect(tokens.has(u)).toBe(true);
    for (const u of Object.values(NETWORK.history)) if (u) expect(tokens.has(new URL(u).origin)).toBe(true);
    for (const u of ['wss://relay.walletconnect.org', 'https://verify.walletconnect.org']) expect(tokens.has(u)).toBe(true);
  });

  it('no location block sets add_header (it would drop the server-level security headers)', () => {
    const text = conf();
    const blocks = [...text.matchAll(/^\s*location\b[^{]*\{([^}]*)\}/gm)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b[1]).not.toMatch(/add_header/);
  });
});

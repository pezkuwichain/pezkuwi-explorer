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
  it('every configured origin is allowed by the deployed CSP', () => {
    const csp = readFileSync('deploy/nginx-explorer.conf', 'utf8');
    for (const c of Object.values(NETWORK.chains)) for (const u of c.rpc) expect(csp).toContain(u);
    for (const u of Object.values(NETWORK.history)) if (u) expect(csp).toContain(new URL(u).origin);
  });
});

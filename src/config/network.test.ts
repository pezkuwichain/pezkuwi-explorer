import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NETWORK, ZAGROS_HISTORY_URL, caip2 } from './network';

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

  const connectSrc = () => {
    const line = conf().split('\n').find((l) => /^\s*add_header\s+Content-Security-Policy\b/.test(l));
    expect(line).toBeDefined();
    const directive = line!.split(';').map((d) => d.trim().replace(/^.*?"/, '')).find((d) => d.startsWith('connect-src '));
    expect(directive).toBeDefined();
    return new Set(directive!.split(/\s+/).slice(1));
  };
  // The site's own origin, from the TLS server's server_name.
  const siteOrigin = () => `https://${/listen 443[\s\S]*?server_name\s+([^;\s]+);/.exec(conf())![1]}`;
  // A URL is allowed by connect-src when its origin is listed, or when it is the site's own origin and 'self' is listed.
  const allowed = (tokens: Set<string>, u: string) =>
    tokens.has(new URL(u).origin) || (new URL(u).origin === siteOrigin() && tokens.has("'self'"));

  // Location blocks with their bodies, nested braces included (e.g. limit_except { ... }).
  const locations = () => {
    const text = conf();
    const out: { head: string; body: string }[] = [];
    for (const m of text.matchAll(/^\s*location\b([^{]*)\{/gm)) {
      let depth = 1, i = m.index! + m[0].length;
      const start = i;
      for (; i < text.length && depth > 0; i++) depth += text[i] === '{' ? 1 : text[i] === '}' ? -1 : 0;
      expect(depth).toBe(0);
      out.push({ head: m[1].trim(), body: text.slice(start, i - 1) });
    }
    return out;
  };

  it('every configured origin is a token of the deployed connect-src', () => {
    const tokens = connectSrc();
    for (const c of Object.values(NETWORK.chains)) for (const u of c.rpc) expect(tokens.has(u)).toBe(true);
    for (const u of Object.values(NETWORK.history)) if (u) expect(allowed(tokens, u)).toBe(true);
    for (const u of ['wss://relay.walletconnect.org', 'https://verify.walletconnect.org']) expect(tokens.has(u)).toBe(true);
  });

  it('the prepared history URL is the site itself, so connect-src \'self\' already allows it', () => {
    expect(new URL(ZAGROS_HISTORY_URL).origin).toBe(siteOrigin());
    expect(siteOrigin()).toBe('https://explorer.pezkuwichain.io');
    expect(allowed(connectSrc(), ZAGROS_HISTORY_URL)).toBe(true);
  });

  it('serves the history endpoint POST-only, size- and rate-limited, proxied to the local indexer', () => {
    const path = new URL(ZAGROS_HISTORY_URL).pathname;
    const loc = locations().find((l) => l.head === `= ${path}`);
    expect(loc).toBeDefined();
    const body = loc!.body.replace(/\s+/g, ' ');
    expect(body).toMatch(/limit_except POST \{ deny all; \}/);
    expect(body).toMatch(/client_max_body_size 8k;/);
    expect(body).toMatch(/limit_req zone=explorer_history burst=20 nodelay;/);
    expect(body).toMatch(/proxy_pass http:\/\/127\.0\.0\.1:3100\/;/);
    expect(body).toMatch(/proxy_set_header Host 127\.0\.0\.1;/);
    expect(body).toMatch(/proxy_read_timeout 15s;/);
    // The indexer's query service advertises itself and allows every origin; both are stripped.
    expect(body).toMatch(/proxy_hide_header X-Powered-By;/);
    expect(body).toMatch(/proxy_hide_header Access-Control-Allow-Origin;/);
    // The zone lives in the http context on the host; the reference copy must say where.
    expect(conf()).toMatch(/limit_req_zone \$binary_remote_addr zone=explorer_history:1m rate=5r\/s;/);
    expect(conf()).toMatch(/\/etc\/nginx\/conf\.d\/explorer-history\.conf/);
  });

  it('lets the WalletConnect Verify iframe load, so the wallet can attest the domain', () => {
    const line = conf().split('\n').find((l) => /^\s*add_header\s+Content-Security-Policy\b/.test(l))!;
    const frame = line.split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-src '));
    expect(frame?.split(/\s+/).slice(1).sort()).toEqual(['https://verify.walletconnect.com', 'https://verify.walletconnect.org']);
  });

  it('no location block sets add_header (it would drop the server-level security headers)', () => {
    const blocks = locations();
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b.body).not.toMatch(/add_header/);
  });

  it('keeps http2 on the listen line (host runs nginx 1.24, no `http2 on;`)', () => {
    expect(conf()).not.toMatch(/http2\s+on/);
    expect(conf()).toMatch(/listen 443 ssl http2;/);
  });
});

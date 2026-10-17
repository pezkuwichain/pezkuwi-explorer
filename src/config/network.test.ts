import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MAINNET, MAINNET_HISTORY_URL, NETWORK, NETWORKS, NETWORK_ID, NETWORK_KEY, ZAGROS, ZAGROS_HISTORY_URL,
  caip2, caip2For, resolveNetworkId, switchNetwork,
} from './network';
import { IWALLET_NETWORK } from './iwallet-network';

const STORED = 'pezkuwi-explorer:' + NETWORK_KEY;
// A fresh copy of the module, resolved from whatever is stored now (NETWORK is resolved once per page load).
const fresh = async () => { vi.resetModules(); return import('./network'); };

describe('which network the explorer reads', () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); vi.restoreAllMocks(); });
  const blocked = () => { throw new DOMException('blocked'); };

  it('a first visit reads mainnet', async () => {
    expect(NETWORK_ID).toBe('mainnet');
    expect(NETWORK).toBe(MAINNET);
    localStorage.clear();
    const m = await fresh();
    expect(m.NETWORK_ID).toBe('mainnet');
    expect(m.NETWORK.chains.relay.genesis).toBe(IWALLET_NETWORK.chains.relay.genesis);
  });
  it('a stored "zagros" reads Zagros', async () => {
    localStorage.setItem(STORED, 'zagros');
    const m = await fresh();
    expect(m.NETWORK_ID).toBe('zagros');
    expect(m.NETWORK.name).toBe('Zagros');
    expect(m.NETWORK.history.assetHub).toBe(ZAGROS_HISTORY_URL);
    expect(m.caip2('relay')).toBe('polkadot:1b0b4727bbb5e44ed587d1056b4ad537');
  });
  it('anything else stored reads mainnet', async () => {
    for (const v of ['Zagros', 'testnet', '', ' zagros', 'null']) expect(resolveNetworkId(v)).toBe('mainnet');
    expect(resolveNetworkId(null)).toBe('mainnet');
    expect(resolveNetworkId('mainnet')).toBe('mainnet');
    localStorage.setItem(STORED, 'kusama');
    expect((await fresh()).NETWORK_ID).toBe('mainnet');
  });
  it('a browser that blocks storage reads mainnet', async () => {
    localStorage.setItem(STORED, 'zagros');
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect((await fresh()).NETWORK_ID).toBe('mainnet');
  });
  it('switching remembers the choice, then reloads', () => {
    const reload = vi.fn();
    expect(switchNetwork('zagros', reload)).toBe(true);
    expect(localStorage.getItem(STORED)).toBe('zagros');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(switchNetwork('mainnet', reload)).toBe(true);
    expect(localStorage.getItem(STORED)).toBe('mainnet');
    expect(reload).toHaveBeenCalledTimes(2);
  });
  it('switching does not reload when the browser would not keep the choice', () => {
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    const reload = vi.fn();
    expect(switchNetwork('zagros', reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
  it('the default reload is the page reload', () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);
    switchNetwork('zagros');
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('i-Wallet stays on mainnet whatever the explorer reads', async () => {
    const before = structuredClone(IWALLET_NETWORK);
    localStorage.setItem(STORED, 'zagros');
    vi.resetModules();
    const zagrosPage = await import('./network');
    const iw = await import('./iwallet-network');
    expect(zagrosPage.NETWORK_ID).toBe('zagros');
    expect(iw.IWALLET_NETWORK).toEqual(before);
    expect(iw.IWALLET_NETWORK.chains.relay.rpc).toEqual(['wss://rpc.pezkuwichain.io']);
    expect(iw.IWALLET_NETWORK.chains.assetHub.genesis).toBe('0xe7c15092dcbe3f320260ddbbc685bfceed9125a3b3d8436db2766201dec3b949');
    switchNetwork('zagros', () => {});
    expect(IWALLET_NETWORK).toEqual(before);
  });
  it('mainnet reuses the i-Wallet chains and has its own history indexer', () => {
    expect(MAINNET.chains).toEqual(IWALLET_NETWORK.chains);
    expect(MAINNET.ss58).toBe(42);
    expect(ZAGROS.ss58).toBe(42);
    expect(MAINNET.history).toEqual({ assetHub: MAINNET_HISTORY_URL, relay: null });
    expect(ZAGROS.history).toEqual({ assetHub: ZAGROS_HISTORY_URL, relay: null });
    // History tests set NETWORK.history.*: the i-Wallet's own object must not be the one they change.
    expect(MAINNET.history).not.toBe(IWALLET_NETWORK.history);
  });
});

describe('network config', () => {
  it('builds CAIP-2 ids from the first 16 genesis bytes, for the network being read', () => {
    expect(caip2For(ZAGROS, 'relay')).toBe('polkadot:1b0b4727bbb5e44ed587d1056b4ad537');
    expect(caip2For(MAINNET, 'relay')).toBe('polkadot:1aa94987791a5544e9667ec249d2cef1');
    expect(caip2('relay')).toBe(caip2For(NETWORK, 'relay'));
  });
  it('uses only wss endpoints', () => {
    for (const n of Object.values(NETWORKS)) for (const c of Object.values(n.chains)) for (const u of c.rpc) expect(u.startsWith('wss://')).toBe(true);
  });
  it('lists the Pezkuwi Wallet tokens: PEZ and USDT (PEZ-20), with measured decimals', () => {
    for (const n of Object.values(NETWORKS)) expect(n.assets).toEqual([
      { id: 1, symbol: 'PEZ', decimals: 12 },
      { id: 1000, symbol: 'USDT', decimals: 6, standard: 'PEZ-20' },
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
    for (const n of Object.values(NETWORKS)) {
      for (const c of Object.values(n.chains)) for (const u of c.rpc) expect(tokens.has(u)).toBe(true);
      for (const u of Object.values(n.history)) if (u) expect(allowed(tokens, u)).toBe(true);
    }
    expect(tokens.has(new URL(MAINNET_HISTORY_URL).origin)).toBe(true);
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

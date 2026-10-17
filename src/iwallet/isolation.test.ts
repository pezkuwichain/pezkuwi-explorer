// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The i-Wallet is mainnet whatever the explorer's network switch says. What guarantees it is that no i-Wallet file
// takes a value that follows that switch: NETWORK (src/config/network.ts) or a helper built on it. Only these are
// allowed from the explorer's network-dependent modules:
//   config/network       type-only imports (ChainKey);
//   lib/address          shortAddress (pure; normaliseAddress encodes for the explorer's network);
//   chain/connections    the timeout constants (getApi connects to the explorer's network);
//   data/balances        loadBalances + Holding, and every call passes the i-Wallet's network;
//   data/history, data/network, data/citizenship: nothing.
const ALLOWED: Record<string, string[] | 'type-only' | 'none'> = {
  'config/network': 'type-only',
  'lib/address': ['shortAddress'],
  'chain/connections': ['REQUEST_TIMEOUT_MS', 'CONNECT_GIVE_UP_MS'],
  'data/balances': ['loadBalances', 'Holding'],
  'data/history': 'none',
  'data/network': 'none',
  'data/citizenship': 'none',
};

const IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'|import\s+(type\s+)?(\*\s+as\s+\w+|\w+)\s+from\s+'([^']+)'/g;

// Problems in one file's source; depth = how many folders below src/iwallet the file sits (resolves '../').
function offences(src: string, depth: number): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT)) {
    const spec = m[3] ?? m[6];
    const prefix = '../'.repeat(depth + 1);
    if (!spec.startsWith(prefix)) continue;
    const mod = spec.slice(prefix.length);
    const rule = ALLOWED[mod];
    if (!rule) continue;
    const typeOnly = Boolean(m[1] ?? m[4]);
    const names = m[2] !== undefined
      ? m[2].split(',').map((n) => n.trim()).filter(Boolean).map((n) => ({ name: n.replace(/^type\s+/, '').split(/\s+as\s+/)[0], type: typeOnly || n.startsWith('type ') }))
      : [{ name: m[5]!, type: typeOnly }];
    for (const n of names) {
      if (n.type && rule !== 'none') continue;
      if (rule === 'type-only' || rule === 'none' || !rule.includes(n.name)) out.push(`${mod}: ${n.name}`);
    }
  }
  if (/from\s+'(\.\.\/)+data\/balances'/.test(src)) {
    for (const call of src.matchAll(/loadBalances\(([^;]*?)\);/gs)) {
      if (!/network:\s*IWALLET_NETWORK/.test(call[1])) out.push('data/balances: loadBalances without network: IWALLET_NETWORK');
    }
  }
  return out;
}

function files(dir: string, depth = 0): { path: string; depth: number }[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p, depth + 1);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [{ path: p, depth }] : [];
  });
}

describe('i-Wallet isolation from the network switch', () => {
  it('the check can fail', () => {
    expect(offences("import { NETWORK } from '../config/network';", 0)).toEqual(['config/network: NETWORK']);
    expect(offences("import { NETWORK, type ChainKey } from '../../config/network';", 1)).toEqual(['config/network: NETWORK']);
    expect(offences("import { normaliseAddress } from '../lib/address';", 0)).toEqual(['lib/address: normaliseAddress']);
    expect(offences("import { getApi } from '../chain/connections';", 0)).toEqual(['chain/connections: getApi']);
    expect(offences("import { findPayment } from '../data/history';", 0)).toEqual(['data/history: findPayment']);
    expect(offences("import { loadBalances } from '../data/balances';\nloadBalances(addr, { keepZero: true });", 0))
      .toEqual(['data/balances: loadBalances without network: IWALLET_NETWORK']);
    expect(offences("import type { ChainKey } from '../config/network';\nimport { shortAddress } from '../lib/address';", 0)).toEqual([]);
  });
  it('no i-Wallet file takes a value that follows the explorer network', () => {
    const all = files('src/iwallet');
    expect(all.length).toBeGreaterThan(10);
    const found = all.flatMap((f) => offences(readFileSync(f.path, 'utf8'), f.depth).map((o) => `${f.path}: ${o}`));
    expect(found).toEqual([]);
  });
});

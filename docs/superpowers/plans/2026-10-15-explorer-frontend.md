# Pezkuwi Explorer Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the read-only, tap-and-use explorer at `explorer.pezkuwichain.io`, running against the Zagros testnet.

**Architecture:** A static React SPA. All data is read in the browser: live state over WebSocket RPC with `@pezkuwi/api`, history from a SubQuery GraphQL endpoint. Every network address lives in `src/config/network.ts`; switching from Zagros to mainnet edits only that file. Where the history indexer does not exist yet, its config entry is `null` and the screens render an honest "being prepared" state.

**Tech Stack:** Node 24, Vite, React 19, TypeScript (strict), react-router-dom 7, i18next + react-i18next, `@pezkuwi/api` 16.5.39, `@pezkuwi/util-crypto` 14.0.26, `@pezkuwi/extension-dapp` 0.62.27, `@walletconnect/sign-client` 2.26.0, `jsqr`, `vite-plugin-pwa`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-explorer-design.md`

## Global Constraints

- Read only. No signing call is ever made; WalletConnect sessions request no signing methods.
- `@pezkuwi/*` packages only. `@polkadot/*` must not appear in `package.json` or the lockfile (CI enforces).
- Six locales: `kmr` (default), `ckb`, `tr`, `en`, `fa`, `ar`. `ckb`, `fa`, `ar` are RTL.
- No user-facing string in a component; every string comes from `src/i18n/locales/<lang>.json`.
- Kurdish text is never invented. Kurmancî/Soranî strings with no native-speaker source are copied from pwap `web/src/i18n/kmr.ts` where the term exists, otherwise written as a draft and listed in `docs/i18n-review.md`.
- No technical vocabulary in the UI: "block", "extrinsic", "hash", "pallet", "era", "nonce" never appear in any locale file.
- Amounts are `bigint` end to end; no `Number` arithmetic on chain amounts.
- Body text ≥ 17 px, button text ≥ 20 px, touch targets ≥ 56 px, WCAG 2.1 AA contrast.
- Colours: primary `#1ec76e` / `#14a05a`, accent `#eeae1f`, error red only for failure, dark surface `#0d1117`. Light theme default; follows `prefers-color-scheme`.
- Fonts Inter + Noto Sans Arabic, self-hosted.
- No IP addresses or host names of machines in the repository; public domain names only.
- Commits in English; no AI attribution lines.

## Measured facts (2026-10-15, Zagros)

| chain | RPC | genesis | spec |
|---|---|---|---|
| relay | `wss://zagros-rpc.pezkuwichain.io` | `0x1b0b4727bbb5e44ed587d1056b4ad537ffb330034509a58866a088d77e792cd5` | zagros/1020014 |
| Asset Hub | `wss://zagros-asset-hub-rpc.pezkuwichain.io` | `0x063f739077881df9f291548de301b2e11d6a45cc545c24e7bf18d8a40f0ce182` | asset-hub-zagros/1020019 |
| People | `wss://zagros-people-rpc.pezkuwichain.io` | `0xc72b38f36affaeb2661018b201c2be02e8c09fc699640525d39200a10fd77878` | people-zagros/1020016 |

- SS58 prefix 42 on all three; native token HEZ, 12 decimals.
- Asset Hub assets: `1` PEZ (12 dec), `1000` wUSDT (6 dec), `2` wHEZ (12 dec).
- People: `identityKyc.kycStatuses: AccountId -> NotStarted|PendingReferral|ReferrerApproved|Approved|Revoked`; `identityKyc.citizenReferrers`; `tiki.citizenNft: AccountId -> u32`; `tiki.userTikis: AccountId -> Vec<Tiki>`; `trust.trustScores: AccountId -> u128`.
- Governance: `referenda` + `convictionVoting` on relay, Asset Hub and People; `treasury` on Asset Hub; elections in `welati` (People).
- Validators: `session.validators()` on the relay (4 on Zagros today).
- SubQuery `historyElements` shape (measured on the existing mainnet indexer, same schema): `id, blockNumber, extrinsicHash (nullable), timestamp (seconds, string), address, transfer{from,to,amount,fee,success}, assetTransfer{assetId,from,to,amount,fee,success}, extrinsic{hash,module,call,fee,success}`. Zagros has **no** indexer yet → `history: null` in config until Plan B lands.
- WalletConnect CAIP-2 id = `polkadot:` + first 16 bytes of genesis hex (32 hex chars).

## Review Focus

1. **A valid address from another network** (e.g. a Polkadot `1…` address) pasted into "Paste address" → accepted, re-encoded to prefix 42, same account shown. Test in Task 3.
2. **Large and tiny amounts** (`1` TYR, `10^30` TYR, wUSDT with 6 decimals) → exact text, no float rounding, no scientific notation. Test in Task 3.
3. **An RPC endpoint that never answers** → that card shows the "could not load" message within 10 s; other cards render. Test in Task 4 and Task 12.
4. **Browser storage blocked** (Safari private mode throws on `localStorage`) → app works, simply does not remember the account. Test in Task 5.
5. **RTL locale with an address and a number inside a sentence** → address and number keep LTR order (wrapped in `<bdi>`). Test in Task 10.

---

## File structure

```
src/
  config/network.ts          endpoints, genesis, assets — the only file mainnet changes
  lib/format.ts              bigint amount formatting, relative time
  lib/address.ts             SS58 validate + normalise to prefix 42
  lib/timeout.ts             withTimeout(promise, ms)
  lib/storage.ts             safe localStorage wrapper
  chain/connections.ts       lazy ApiPromise per chain
  data/balances.ts           native + asset balances
  data/history.ts            SubQuery history + payment lookup
  data/citizenship.ts        kyc status, tikis, trust, citizen NFT
  data/network.ts            liveness, validators, referenda, treasury
  hooks/useAsync.ts          {status, data, error} for a promise-returning fn
  account/AccountContext.tsx open/forget account, remembered address
  account/connectors/extension.ts
  account/connectors/walletconnect.ts
  account/connectors/qr.ts
  i18n/index.ts, i18n/locales/{kmr,ckb,tr,en,fa,ar}.json
  ui/theme.css, ui/Layout.tsx, ui/BigButton.tsx, ui/Card.tsx, ui/StatusLight.tsx, ui/LanguagePicker.tsx
  screens/Home.tsx, OpenAccount.tsx, Account.tsx, ActivityDetail.tsx, PaymentStatus.tsx, Citizenship.tsx, Network.tsx
  main.tsx, App.tsx
tests mirror src/ under src/**/*.test.ts(x); e2e/smoke.spec.ts
deploy/nginx-explorer.conf   reference copy of the host vhost (domain only)
.github/workflows/ci.yml, deploy.yml
```

---

### Task 1: Scaffold, CI, i18n skeleton, theme

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/i18n/index.ts`, `src/i18n/locales/*.json`, `src/ui/theme.css`, `.github/workflows/ci.yml`, `scripts/check-deps.mjs`, `docs/i18n-review.md`
- Test: `src/i18n/index.test.ts`

**Interfaces:**
- Produces: `i18n` instance; `LOCALES: readonly ['kmr','ckb','tr','en','fa','ar']`; `isRtl(lang: string): boolean`; `setLanguage(lang: Locale): void` (persists via `storage`, sets `<html lang dir>`).

- [ ] **Step 1: Create the project**

```bash
npm create vite@latest . -- --template react-ts
npm i -E react-router-dom i18next react-i18next @pezkuwi/api@16.5.39 @pezkuwi/util-crypto@14.0.26 @pezkuwi/extension-dapp@0.62.27 @walletconnect/sign-client@2.26.0 jsqr
npm i -E -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test vite-plugin-pwa
```
Set `"engines": {"node": ">=24"}` and scripts: `"test": "vitest run"`, `"typecheck": "tsc -b --noEmit"`, `"check-deps": "node scripts/check-deps.mjs"`, `"e2e": "playwright test"`.

- [ ] **Step 2: Write the failing i18n test**

```ts
// src/i18n/index.test.ts
import { describe, expect, it } from 'vitest';
import { LOCALES, isRtl } from './index';
import kmr from './locales/kmr.json';

describe('i18n', () => {
  it('defaults to Kurmanci and lists six locales', async () => {
    const { default: i18n } = await import('./index');
    expect(i18n.language).toBe('kmr');
    expect(LOCALES).toEqual(['kmr', 'ckb', 'tr', 'en', 'fa', 'ar']);
  });
  it('marks ckb, fa, ar as right-to-left', () => {
    expect(['ckb', 'fa', 'ar'].every(isRtl)).toBe(true);
    expect(['kmr', 'tr', 'en'].some(isRtl)).toBe(false);
  });
  it('every locale has exactly the keys of kmr', async () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    for (const l of LOCALES) {
      const m = (await import(`./locales/${l}.json`)).default;
      expect(keys(m).sort()).toEqual(keys(kmr).sort());
    }
  });
  it('no locale uses technical vocabulary', async () => {
    const banned = /\b(block|extrinsic|hash|pallet|era|nonce)\b/i;
    for (const l of LOCALES) {
      const text = JSON.stringify((await import(`./locales/${l}.json`)).default);
      expect(text).not.toMatch(banned);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/i18n` — Expected: FAIL, module `./index` not found.

- [ ] **Step 4: Implement i18n**

```ts
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../lib/storage';
import kmr from './locales/kmr.json';
import ckb from './locales/ckb.json';
import tr from './locales/tr.json';
import en from './locales/en.json';
import fa from './locales/fa.json';
import ar from './locales/ar.json';

export const LOCALES = ['kmr', 'ckb', 'tr', 'en', 'fa', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
const RTL = new Set<string>(['ckb', 'fa', 'ar']);
export const isRtl = (lang: string) => RTL.has(lang);

const saved = storage.get('lang');
const initial: Locale = (LOCALES as readonly string[]).includes(saved ?? '') ? (saved as Locale) : 'kmr';

void i18n.use(initReactI18next).init({
  resources: { kmr: { t: kmr }, ckb: { t: ckb }, tr: { t: tr }, en: { t: en }, fa: { t: fa }, ar: { t: ar } },
  lng: initial,
  fallbackLng: 'kmr',
  defaultNS: 't',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Locale) {
  void i18n.changeLanguage(lang);
  storage.set('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
}
export default i18n;
```

`src/lib/storage.ts` is needed here; create it now with the implementation from Task 5 Step 3 (its tests land in Task 5).

Create `src/i18n/locales/en.json` with the full key set used by all screens:

```json
{
  "app": { "name": "Pezkuwi Explorer", "experts": "For experts: apps.pezkuwichain.io", "back": "Back", "language": "Language" },
  "home": { "account": "My account", "payment": "Did my payment arrive?", "citizenship": "Citizenship", "network": "Network" },
  "status": { "up": "The network is working", "down": "The network is not answering", "checking": "Checking the network…" },
  "open": { "title": "Open your account", "wallet": "Open with my wallet", "scan": "Scan QR", "paste": "Paste address", "pastePlaceholder": "Paste your address here", "invalid": "This is not a valid address. Check it and try again.", "noWallet": "No Pezkuwi wallet was found on this device.", "rejected": "The wallet did not share an account.", "go": "Open" },
  "account": { "total": "Total", "activity": "Recent activity", "forget": "Forget on this device", "sent": "You sent <amount/> to <who/>", "received": "You received <amount/> from <who/>", "fee": "Fee", "when": "When", "from": "From", "to": "To", "ok": "Done", "failed": "Failed", "empty": "No activity yet." },
  "payment": { "title": "Did my payment arrive?", "placeholder": "Paste the transaction code or an address", "arrived": "Arrived", "onTheWay": "On its way", "notArrived": "Did not arrive", "arrivedText": "The money reached <who/>.", "notArrivedText": "It was not sent. Your money is still in your account.", "notFound": "We could not find this payment yet. If you just sent it, wait a minute and try again." },
  "citizenship": { "title": "Citizenship", "applied": "Applied", "approved": "Approved", "citizen": "Citizen", "notStarted": "No application yet", "revoked": "Citizenship was revoked", "roles": "Roles", "trust": "Trust score", "noRoles": "No roles yet." },
  "network": { "title": "Network", "votes": "Votes", "noVotes": "No active votes right now.", "voteHint": "To vote, use apps.pezkuwichain.io", "treasury": "Treasury", "validators": "Validators", "validatorsActive": "{{count}} active" },
  "state": { "loading": "Loading…", "error": "This could not be loaded. Try again later.", "preparing": "This section is being prepared.", "retry": "Try again" }
}
```

Create `kmr.json`, `ckb.json`, `tr.json`, `fa.json`, `ar.json` with the same keys. `tr` is written directly. For `kmr` and `ckb`: take each term from pwap `web/src/i18n/kmr.ts` (and its Soranî file) where the same meaning exists; every other string is a draft and is listed in `docs/i18n-review.md` as a table `key | kmr draft | ckb draft | reviewer` for native-speaker review. `fa` and `ar` the same way, listed in the same file.

- [ ] **Step 5: Theme and shell**

```css
/* src/ui/theme.css */
@font-face { font-family: Inter; src: url('/fonts/Inter.woff2') format('woff2'); font-display: swap; }
@font-face { font-family: 'Noto Sans Arabic'; src: url('/fonts/NotoSansArabic.woff2') format('woff2'); font-display: swap; }
:root {
  --green: #1ec76e; --green-strong: #14a05a; --gold: #eeae1f; --red: #d93a3a;
  --bg: #ffffff; --surface: #f4f6f8; --text: #0d1117; --muted: #4b5563; --on-green: #0d1117;
  --radius: 20px; --tap: 56px;
  font-family: Inter, 'Noto Sans Arabic', system-ui, sans-serif; font-size: 17px; line-height: 1.5;
  color: var(--text); background: var(--bg);
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0d1117; --surface: #161b22; --text: #f0f3f6; --muted: #9ca3af; }
}
:root[dir='rtl'] { font-family: 'Noto Sans Arabic', Inter, system-ui, sans-serif; }
body { margin: 0; background: var(--bg); }
button, a.button { min-height: var(--tap); font-size: 20px; border-radius: var(--radius); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

Copy `Inter.woff2` and `NotoSansArabic.woff2` (variable fonts, OFL) into `public/fonts/` and add `public/fonts/OFL.txt`.

- [ ] **Step 6: Dependency guard and CI**

```js
// scripts/check-deps.mjs
import { readFileSync } from 'node:fs';
const lock = readFileSync('package-lock.json', 'utf8');
if (/"node_modules\/@polkadot\//.test(lock)) { console.error('@polkadot/* found in lockfile'); process.exit(1); }
console.log('dependency guard ok');
```

```yaml
# .github/workflows/ci.yml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
permissions: { contents: read }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run check-deps
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - name: bundle size
        run: test $(du -sk dist | cut -f1) -lt 4096
```

- [ ] **Step 7: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Scaffold explorer with six-locale i18n, theme and CI"
```

---

### Task 2: Network config

**Files:**
- Create: `src/config/network.ts`
- Test: `src/config/network.test.ts`

**Interfaces:**
- Produces: `type ChainKey = 'relay' | 'assetHub' | 'people'`; `NETWORK: { name: string; ss58: 42; native: { symbol: 'HEZ'; decimals: 12 }; chains: Record<ChainKey, { rpc: string[]; genesis: `0x${string}` }>; assets: { id: number; symbol: string; decimals: number }[]; history: { assetHub: string | null; relay: string | null }; walletConnectProjectId: string }`; `caip2(chain: ChainKey): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/config/network.test.ts
import { describe, expect, it } from 'vitest';
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
});
```

- [ ] **Step 2: Run it to verify it fails** — `npx vitest run src/config` → FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/config/network.ts
// The only file that changes when the explorer moves from Zagros to mainnet.
export type ChainKey = 'relay' | 'assetHub' | 'people';

export const NETWORK = {
  name: 'Zagros',
  ss58: 42,
  native: { symbol: 'HEZ', decimals: 12 },
  chains: {
    relay: { rpc: ['wss://zagros-rpc.pezkuwichain.io'], genesis: '0x1b0b4727bbb5e44ed587d1056b4ad537ffb330034509a58866a088d77e792cd5' },
    assetHub: { rpc: ['wss://zagros-asset-hub-rpc.pezkuwichain.io'], genesis: '0x063f739077881df9f291548de301b2e11d6a45cc545c24e7bf18d8a40f0ce182' },
    people: { rpc: ['wss://zagros-people-rpc.pezkuwichain.io'], genesis: '0xc72b38f36affaeb2661018b201c2be02e8c09fc699640525d39200a10fd77878' },
  },
  assets: [
    { id: 1, symbol: 'PEZ', decimals: 12 },
    { id: 1000, symbol: 'wUSDT', decimals: 6 },
    { id: 2, symbol: 'wHEZ', decimals: 12 },
  ],
  // null = no indexer for this chain yet; history screens show "being prepared".
  history: { assetHub: null as string | null, relay: null as string | null },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '',
} as const;

export const caip2 = (chain: ChainKey) => `polkadot:${NETWORK.chains[chain].genesis.slice(2, 34)}`;
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add Zagros network config"`

---

### Task 3: Amount, time and address helpers

**Files:**
- Create: `src/lib/format.ts`, `src/lib/address.ts`
- Test: `src/lib/format.test.ts`, `src/lib/address.test.ts`

**Interfaces:**
- Produces: `formatAmount(value: bigint, decimals: number, symbol: string, locale: string): string`; `relativeTime(unixSeconds: number, now: number, locale: string): string`; `normaliseAddress(input: string): string | null` (returns prefix-42 SS58 or null); `shortAddress(a: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/format.test.ts
import { describe, expect, it } from 'vitest';
import { formatAmount, relativeTime } from './format';

describe('formatAmount', () => {
  it('formats whole and fractional HEZ', () => {
    expect(formatAmount(5_000_000_000_000n, 12, 'HEZ', 'en')).toBe('5 HEZ');
    expect(formatAmount(1_250_000_000_000n, 12, 'HEZ', 'en')).toBe('1.25 HEZ');
  });
  it('keeps the smallest unit visible instead of rounding to zero', () => {
    expect(formatAmount(1n, 12, 'HEZ', 'en')).toBe('0.000000000001 HEZ');
  });
  it('never uses scientific notation for huge values', () => {
    expect(formatAmount(10n ** 30n, 12, 'HEZ', 'en')).toBe('1,000,000,000,000,000,000 HEZ');
  });
  it('respects 6-decimal assets', () => {
    expect(formatAmount(1_500_000n, 6, 'wUSDT', 'en')).toBe('1.5 wUSDT');
  });
  it('shows at most 4 fractional digits once the whole part is non-zero', () => {
    expect(formatAmount(1_234_567_890_000n, 12, 'HEZ', 'en')).toBe('1.2345 HEZ');
  });
});

describe('relativeTime', () => {
  it('says minutes and hours in the chosen language', () => {
    const now = 1_800_000_000;
    expect(relativeTime(now - 120, now, 'en')).toBe('2 minutes ago');
    expect(relativeTime(now - 7200, now, 'en')).toBe('2 hours ago');
  });
});
```

```ts
// src/lib/address.test.ts
import { describe, expect, it } from 'vitest';
import { normaliseAddress, shortAddress } from './address';

const ALICE_42 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const ALICE_POLKADOT = '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5';

describe('normaliseAddress', () => {
  it('accepts a prefix-42 address unchanged', () => expect(normaliseAddress(ALICE_42)).toBe(ALICE_42));
  it('re-encodes an address from another network to prefix 42', () =>
    expect(normaliseAddress(ALICE_POLKADOT)).toBe(ALICE_42));
  it('trims whitespace from pasted text', () => expect(normaliseAddress(`  ${ALICE_42}\n`)).toBe(ALICE_42));
  it('rejects a bad checksum and garbage', () => {
    expect(normaliseAddress(ALICE_42.slice(0, -1) + 'Z')).toBeNull();
    expect(normaliseAddress('hello')).toBeNull();
    expect(normaliseAddress('')).toBeNull();
  });
});

describe('shortAddress', () => {
  it('keeps 6 leading and 6 trailing characters', () => expect(shortAddress(ALICE_42)).toBe('5Grwva…GKutQY'));
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/format.ts
const INTL: Record<string, string> = { kmr: 'ku', ckb: 'ckb', tr: 'tr', en: 'en', fa: 'fa', ar: 'ar' };

export function formatAmount(value: bigint, decimals: number, symbol: string, locale: string): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  if (whole > 0n && frac.length > 4) frac = frac.slice(0, 4).replace(/0+$/, '');
  const nf = new Intl.NumberFormat(INTL[locale] ?? 'en', { useGrouping: true });
  const sep = nf.formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  const wholeText = nf.format(whole);
  return `${neg ? '-' : ''}${wholeText}${frac ? sep + frac : ''} ${symbol}`;
}

export function relativeTime(unixSeconds: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(INTL[locale] ?? 'en', { numeric: 'auto' });
  const d = unixSeconds - now;
  const abs = Math.abs(d);
  if (abs < 3600) return rtf.format(Math.round(d / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(d / 3600), 'hour');
  return rtf.format(Math.round(d / 86400), 'day');
}
```

```ts
// src/lib/address.ts
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { NETWORK } from '../config/network';

export function normaliseAddress(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const pk = decodeAddress(text);
    if (pk.length !== 32) return null;
    return encodeAddress(pk, NETWORK.ss58);
  } catch {
    return null;
  }
}

export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a);
```

- [ ] **Step 4: Run tests** — PASS. If `Intl` in the test runtime lacks `ku`, the `en` cases still pass; Kurdish grouping is verified manually in Task 18.
- [ ] **Step 5: Commit** — `git commit -am "Add exact bigint formatting and address normalisation"`

---

### Task 4: Timeout and chain connections

**Files:**
- Create: `src/lib/timeout.ts`, `src/chain/connections.ts`, `src/hooks/useAsync.ts`
- Test: `src/lib/timeout.test.ts`, `src/hooks/useAsync.test.tsx`

**Interfaces:**
- Produces: `withTimeout<T>(p: Promise<T>, ms: number): Promise<T>` (rejects with `TimeoutError`); `class TimeoutError extends Error`; `getApi(chain: ChainKey): Promise<ApiPromise>` (one cached instance per chain, 10 s connect timeout, cache cleared on failure); `useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { status: 'loading'|'ok'|'error'; data?: T; retry(): void }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/timeout.test.ts
import { describe, expect, it, vi } from 'vitest';
import { withTimeout, TimeoutError } from './timeout';

describe('withTimeout', () => {
  it('resolves when the promise is fast', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
  it('rejects with TimeoutError when the promise never settles', async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 10_000);
    vi.advanceTimersByTime(10_000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    vi.useRealTimers();
  });
});
```

```tsx
// src/hooks/useAsync.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('goes loading -> ok', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(1), []));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ok', data: 1 }));
  });
  it('goes to error and recovers on retry', async () => {
    let fail = true;
    const { result } = renderHook(() => useAsync(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve(2)), []));
    await waitFor(() => expect(result.current.status).toBe('error'));
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ok', data: 2 }));
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/timeout.ts
export class TimeoutError extends Error {}
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(`timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
```

```ts
// src/chain/connections.ts
import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { NETWORK, type ChainKey } from '../config/network';
import { withTimeout } from '../lib/timeout';

export const REQUEST_TIMEOUT_MS = 10_000;
const cache = new Map<ChainKey, Promise<ApiPromise>>();

export function getApi(chain: ChainKey): Promise<ApiPromise> {
  let p = cache.get(chain);
  if (!p) {
    const provider = new WsProvider([...NETWORK.chains[chain].rpc], 2_500);
    p = withTimeout(ApiPromise.create({ provider, noInitWarn: true }), REQUEST_TIMEOUT_MS);
    p.catch(() => { cache.delete(chain); void provider.disconnect(); });
    cache.set(chain, p);
  }
  return p;
}
```

```ts
// src/hooks/useAsync.ts
import { useCallback, useEffect, useState } from 'react';
type State<T> = { status: 'loading' | 'ok' | 'error'; data?: T };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    fn().then((data) => live && setState({ status: 'ok', data }), () => live && setState({ status: 'error' }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, retry };
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add request timeouts, cached chain connections and useAsync"`

---

### Task 5: Safe storage and the account context

**Files:**
- Create: `src/lib/storage.ts` (if not created in Task 1), `src/account/AccountContext.tsx`
- Test: `src/lib/storage.test.ts`, `src/account/AccountContext.test.tsx`

**Interfaces:**
- Produces: `storage: { get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void }` (never throws); `AccountProvider`; `useAccount(): { address: string | null; open(address: string): boolean; forget(): void }` (`open` normalises, remembers, returns false on invalid input).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/storage.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storage } from './storage';

describe('storage', () => {
  afterEach(() => vi.restoreAllMocks());
  it('round-trips values', () => { storage.set('a', '1'); expect(storage.get('a')).toBe('1'); storage.remove('a'); expect(storage.get('a')).toBeNull(); });
  it('never throws when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked'); });
    expect(() => storage.set('a', '1')).not.toThrow();
    expect(storage.get('a')).toBeNull();
  });
});
```

```tsx
// src/account/AccountContext.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AccountProvider, useAccount } from './AccountContext';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const wrapper = ({ children }: { children: React.ReactNode }) => <AccountProvider>{children}</AccountProvider>;

describe('account context', () => {
  it('opens, remembers and forgets an account', () => {
    const { result } = renderHook(() => useAccount(), { wrapper });
    act(() => { expect(result.current.open(ALICE)).toBe(true); });
    expect(result.current.address).toBe(ALICE);
    expect(renderHook(() => useAccount(), { wrapper }).result.current.address).toBe(ALICE);
    act(() => result.current.forget());
    expect(result.current.address).toBeNull();
  });
  it('rejects invalid input without changing the open account', () => {
    const { result } = renderHook(() => useAccount(), { wrapper });
    act(() => { expect(result.current.open('nope')).toBe(false); });
    expect(result.current.address).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/storage.ts
// Per-device conveniences only. Private browsing may throw on any access.
const PREFIX = 'pezkuwi-explorer:';
export const storage = {
  get(k: string): string | null { try { return localStorage.getItem(PREFIX + k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(PREFIX + k, v); } catch { /* not remembered */ } },
  remove(k: string): void { try { localStorage.removeItem(PREFIX + k); } catch { /* nothing to remove */ } },
};
```

```tsx
// src/account/AccountContext.tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { normaliseAddress } from '../lib/address';
import { storage } from '../lib/storage';

type Ctx = { address: string | null; open(address: string): boolean; forget(): void };
const AccountCtx = createContext<Ctx | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => normaliseAddress(storage.get('account') ?? ''));
  const open = useCallback((input: string) => {
    const a = normaliseAddress(input);
    if (!a) return false;
    storage.set('account', a);
    setAddress(a);
    return true;
  }, []);
  const forget = useCallback(() => { storage.remove('account'); setAddress(null); }, []);
  return <AccountCtx.Provider value={{ address, open, forget }}>{children}</AccountCtx.Provider>;
}

export function useAccount(): Ctx {
  const c = useContext(AccountCtx);
  if (!c) throw new Error('useAccount outside AccountProvider');
  return c;
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add safe storage and remembered account context"`

---

### Task 6: Balances

**Files:**
- Create: `src/data/balances.ts`
- Test: `src/data/balances.test.ts`

**Interfaces:**
- Consumes: `getApi`, `NETWORK`.
- Produces: `type Holding = { symbol: string; decimals: number; amount: bigint }`; `loadBalances(address: string, deps?: { getApi }): Promise<Holding[]>` — HEZ = relay free+reserved + Asset Hub free+reserved; then each asset in `NETWORK.assets` with a non-zero balance; HEZ always first.

- [ ] **Step 1: Write the failing test** (fake APIs, no network)

```ts
// src/data/balances.test.ts
import { describe, expect, it } from 'vitest';
import { loadBalances } from './balances';

const acct = (free: bigint, reserved: bigint) => ({ data: { free: { toBigInt: () => free }, reserved: { toBigInt: () => reserved } } });
const asset = (bal: bigint | null) => ({ isSome: bal !== null, unwrap: () => ({ balance: { toBigInt: () => bal ?? 0n } }) });

const fake = (chain: string) => Promise.resolve({
  query: {
    system: { account: () => Promise.resolve(chain === 'relay' ? acct(1n, 2n) : acct(10n, 0n)) },
    assets: { account: (id: number) => Promise.resolve(asset(id === 1 ? 5n : id === 1000 ? null : 0n)) },
  },
}) as never;

describe('loadBalances', () => {
  it('sums HEZ across relay and Asset Hub and lists non-zero assets', async () => {
    const r = await loadBalances('5Grw', { getApi: fake });
    expect(r).toEqual([
      { symbol: 'HEZ', decimals: 12, amount: 13n },
      { symbol: 'PEZ', decimals: 12, amount: 5n },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/data/balances.ts
import { getApi as realGetApi } from '../chain/connections';
import { NETWORK } from '../config/network';
import { withTimeout } from '../lib/timeout';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';

export type Holding = { symbol: string; decimals: number; amount: bigint };

export async function loadBalances(address: string, deps = { getApi: realGetApi }): Promise<Holding[]> {
  const [relay, ah] = await Promise.all([deps.getApi('relay'), deps.getApi('assetHub')]);
  const native = async (api: typeof relay) => {
    const a = (await withTimeout(api.query.system.account(address), REQUEST_TIMEOUT_MS)) as never as {
      data: { free: { toBigInt(): bigint }; reserved: { toBigInt(): bigint } };
    };
    return a.data.free.toBigInt() + a.data.reserved.toBigInt();
  };
  const [rHez, aHez] = await Promise.all([native(relay), native(ah)]);
  const out: Holding[] = [{ symbol: NETWORK.native.symbol, decimals: NETWORK.native.decimals, amount: rHez + aHez }];
  for (const asset of NETWORK.assets) {
    const opt = (await withTimeout(ah.query.assets.account(asset.id, address), REQUEST_TIMEOUT_MS)) as never as {
      isSome: boolean; unwrap(): { balance: { toBigInt(): bigint } };
    };
    const amount = opt.isSome ? opt.unwrap().balance.toBigInt() : 0n;
    if (amount > 0n) out.push({ symbol: asset.symbol, decimals: asset.decimals, amount });
  }
  return out;
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Live check** — `npx tsx -e "import('./src/data/balances.ts').then(m=>m.loadBalances('<a Zagros citizen address from identityKyc.kycStatuses>')).then(console.log)"` prints a HEZ holding. Use any key listed by `identityKyc.kycStatuses.entries()`.
- [ ] **Step 6: Commit** — `git commit -am "Load native and asset balances"`

---

### Task 7: History and payment lookup

**Files:**
- Create: `src/data/history.ts`
- Test: `src/data/history.test.ts`

**Interfaces:**
- Produces: `class NotIndexedError extends Error` (thrown when `NETWORK.history.assetHub` is null); `type Activity = { id: string; when: number; direction: 'sent' | 'received' | 'other'; counterparty: string | null; symbol: string; decimals: number; amount: bigint; fee: bigint; ok: boolean; code: string | null }`; `loadActivity(address: string, fetcher?: typeof fetch): Promise<Activity[]>` (newest first, 25 items); `findPayment(query: string, fetcher?): Promise<{ status: 'arrived' | 'failed' | 'notFound'; activity?: Activity }>` — `query` is a `0x` + 64-hex code or an address (then the newest transfer involving it).

- [ ] **Step 1: Write the failing tests**

```ts
// src/data/history.test.ts
import { describe, expect, it, vi } from 'vitest';
import { NETWORK } from '../config/network';
import { loadActivity, findPayment, NotIndexedError } from './history';

const ME = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const node = (o: object) => ({ id: 'x', blockNumber: 1, extrinsicHash: '0x' + 'ab'.repeat(32), timestamp: '1800000000', address: ME, transfer: null, assetTransfer: null, extrinsic: null, ...o });
const reply = (nodes: object[]) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { historyElements: { nodes } } }) });

describe('history', () => {
  it('throws NotIndexedError while no indexer is configured', async () => {
    (NETWORK.history as { assetHub: string | null }).assetHub = null;
    await expect(loadActivity(ME)).rejects.toBeInstanceOf(NotIndexedError);
  });
  it('maps native and asset transfers into plain activity', async () => {
    (NETWORK.history as { assetHub: string | null }).assetHub = 'https://example.invalid/graphql';
    const f = reply([
      node({ transfer: { from: ME, to: BOB, amount: '5000000000000', fee: '1000', success: true } }),
      node({ assetTransfer: { assetId: '1000', from: BOB, to: ME, amount: '1500000', fee: '0', success: true } }),
    ]);
    const a = await loadActivity(ME, f);
    expect(a[0]).toMatchObject({ direction: 'sent', counterparty: BOB, symbol: 'HEZ', amount: 5_000_000_000_000n, fee: 1000n, ok: true });
    expect(a[1]).toMatchObject({ direction: 'received', counterparty: BOB, symbol: 'wUSDT', decimals: 6, amount: 1_500_000n });
  });
  it('reports a failed payment as failed, not as missing', async () => {
    const f = reply([node({ transfer: { from: ME, to: BOB, amount: '1', fee: '1', success: false } })]);
    expect((await findPayment('0x' + 'ab'.repeat(32), f)).status).toBe('failed');
  });
  it('reports notFound for an unknown code', async () => {
    expect((await findPayment('0x' + 'cd'.repeat(32), reply([]))).status).toBe('notFound');
  });
  it('rejects input that is neither a code nor an address', async () => {
    await expect(findPayment('hello', reply([]))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/data/history.ts
import { NETWORK } from '../config/network';
import { normaliseAddress } from '../lib/address';
import { withTimeout } from '../lib/timeout';
import { REQUEST_TIMEOUT_MS } from '../chain/connections';

export class NotIndexedError extends Error {}
export type Activity = {
  id: string; when: number; direction: 'sent' | 'received' | 'other'; counterparty: string | null;
  symbol: string; decimals: number; amount: bigint; fee: bigint; ok: boolean; code: string | null;
};
type Node = {
  id: string; extrinsicHash: string | null; timestamp: string; address: string;
  transfer: { from: string; to: string; amount: string; fee: string; success: boolean } | null;
  assetTransfer: { assetId: string; from: string; to: string; amount: string; fee: string; success: boolean } | null;
  extrinsic: { fee: string; success: boolean } | null;
};
const FIELDS = 'id extrinsicHash timestamp address transfer assetTransfer extrinsic';

async function query(filter: string, fetcher: typeof fetch): Promise<Node[]> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const body = JSON.stringify({ query: `{historyElements(first:25,orderBy:TIMESTAMP_DESC,filter:${filter}){nodes{${FIELDS}}}}` });
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }), REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(`history ${res.status}`);
  return (await res.json()).data.historyElements.nodes as Node[];
}

function toActivity(n: Node, me: string): Activity {
  const t = n.transfer ?? n.assetTransfer;
  const asset = n.assetTransfer ? NETWORK.assets.find((a) => String(a.id) === n.assetTransfer!.assetId) : null;
  const symbol = asset?.symbol ?? (n.assetTransfer ? `#${n.assetTransfer.assetId}` : NETWORK.native.symbol);
  const decimals = asset?.decimals ?? NETWORK.native.decimals;
  if (!t) {
    return { id: n.id, when: Number(n.timestamp), direction: 'other', counterparty: null, symbol, decimals, amount: 0n,
      fee: BigInt(n.extrinsic?.fee ?? '0'), ok: n.extrinsic?.success ?? true, code: n.extrinsicHash };
  }
  const sent = t.from === me;
  return { id: n.id, when: Number(n.timestamp), direction: sent ? 'sent' : 'received', counterparty: sent ? t.to : t.from,
    symbol, decimals, amount: BigInt(t.amount), fee: BigInt(t.fee), ok: t.success, code: n.extrinsicHash };
}

export async function loadActivity(address: string, fetcher: typeof fetch = fetch): Promise<Activity[]> {
  return (await query(`{address:{equalTo:${JSON.stringify(address)}}}`, fetcher)).map((n) => toActivity(n, address));
}

export async function findPayment(input: string, fetcher: typeof fetch = fetch) {
  const text = input.trim();
  let nodes: Node[];
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) {
    nodes = await query(`{extrinsicHash:{equalTo:${JSON.stringify(text.toLowerCase())}}}`, fetcher);
  } else {
    const a = normaliseAddress(text);
    if (!a) throw new Error('not a code or address');
    nodes = (await query(`{address:{equalTo:${JSON.stringify(a)}}}`, fetcher)).filter((n) => n.transfer || n.assetTransfer);
  }
  const n = nodes[0];
  if (!n) return { status: 'notFound' as const };
  const act = toActivity(n, n.address);
  return { status: act.ok ? ('arrived' as const) : ('failed' as const), activity: act };
}
```

"On its way" is not an indexer state: the indexer only sees included transfers. The Payment screen (Task 13) shows "On its way" when a code is not found **and** `NETWORK.history.assetHub` lags the chain head by more than 20 blocks (`_metadata.lastProcessedHeight` vs `targetHeight`); otherwise "not found". Add `indexerLag(fetcher): Promise<number>` here:

```ts
export async function indexerLag(fetcher: typeof fetch = fetch): Promise<number> {
  const url = NETWORK.history.assetHub;
  if (!url) throw new NotIndexedError();
  const res = await withTimeout(fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{_metadata{lastProcessedHeight targetHeight}}' }) }), REQUEST_TIMEOUT_MS);
  const m = (await res.json()).data._metadata;
  return m.targetHeight - m.lastProcessedHeight;
}
```

and its test:

```ts
it('computes indexer lag from metadata', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { _metadata: { lastProcessedHeight: 90, targetHeight: 120 } } }) });
  const { indexerLag } = await import('./history');
  expect(await indexerLag(f)).toBe(30);
});
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add history and payment lookup over SubQuery"`

---

### Task 8: Citizenship

**Files:**
- Create: `src/data/citizenship.ts`
- Test: `src/data/citizenship.test.ts`

**Interfaces:**
- Produces: `type Stage = 'notStarted' | 'applied' | 'approved' | 'citizen' | 'revoked'`; `loadCitizenship(address, deps?): Promise<{ stage: Stage; roles: string[]; trust: bigint }>`.
- Stage mapping: `NotStarted → notStarted`; `PendingReferral | ReferrerApproved → applied`; `Approved` without `tiki.citizenNft → approved`; `Approved` with `tiki.citizenNft → citizen`; `Revoked → revoked`.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/citizenship.test.ts
import { describe, expect, it } from 'vitest';
import { loadCitizenship } from './citizenship';

const people = (status: string, nft: boolean, tikis: string[], trust: bigint) => () => Promise.resolve({
  query: {
    identityKyc: { kycStatuses: () => Promise.resolve({ type: status }) },
    tiki: {
      citizenNft: () => Promise.resolve({ isSome: nft }),
      userTikis: () => Promise.resolve(tikis.map((t) => ({ type: t }))),
    },
    trust: { trustScores: () => Promise.resolve({ toBigInt: () => trust }) },
  },
}) as never;

describe('loadCitizenship', () => {
  it.each([
    ['NotStarted', false, 'notStarted'],
    ['PendingReferral', false, 'applied'],
    ['ReferrerApproved', false, 'applied'],
    ['Approved', false, 'approved'],
    ['Approved', true, 'citizen'],
    ['Revoked', false, 'revoked'],
  ])('%s (nft %s) -> %s', async (status, nft, stage) => {
    const r = await loadCitizenship('5Grw', { getApi: people(status, nft as boolean, [], 0n) });
    expect(r.stage).toBe(stage);
  });
  it('returns roles and trust', async () => {
    const r = await loadCitizenship('5Grw', { getApi: people('Approved', true, ['Welati', 'Noter'], 42n) });
    expect(r).toEqual({ stage: 'citizen', roles: ['Welati', 'Noter'], trust: 42n });
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/data/citizenship.ts
import { getApi as realGetApi, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { withTimeout } from '../lib/timeout';

export type Stage = 'notStarted' | 'applied' | 'approved' | 'citizen' | 'revoked';

export async function loadCitizenship(address: string, deps = { getApi: realGetApi }) {
  const api = await deps.getApi('people');
  const q = api.query as never as {
    identityKyc: { kycStatuses(a: string): Promise<{ type: string }> };
    tiki: { citizenNft(a: string): Promise<{ isSome: boolean }>; userTikis(a: string): Promise<{ type: string }[]> };
    trust: { trustScores(a: string): Promise<{ toBigInt(): bigint }> };
  };
  const [status, nft, tikis, trust] = await withTimeout(Promise.all([
    q.identityKyc.kycStatuses(address), q.tiki.citizenNft(address), q.tiki.userTikis(address), q.trust.trustScores(address),
  ]), REQUEST_TIMEOUT_MS);
  const stage: Stage =
    status.type === 'Revoked' ? 'revoked'
    : status.type === 'Approved' ? (nft.isSome ? 'citizen' : 'approved')
    : status.type === 'NotStarted' ? 'notStarted' : 'applied';
  return { stage, roles: tikis.map((t) => t.type), trust: trust.toBigInt() };
}
```

Role names (`Welati`, `Noter`, …) are displayed through `t('tiki.<Name>')`; add a `tiki` section to every locale file with one key per variant of the on-chain `Tiki` enum (read the full list with `api.registry.createType('PezpalletTikiPezpalletTiki').defKeys` and paste it). Kurmancî names are the on-chain names themselves; other locales are drafts listed in `docs/i18n-review.md`. Update the i18n key-set test fixture accordingly.

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Live check** — run `loadCitizenship` against an address from `identityKyc.kycStatuses.entries()` on Zagros; expect a non-`notStarted` stage.
- [ ] **Step 6: Commit** — `git commit -am "Load citizenship stage, roles and trust"`

---

### Task 9: Network overview

**Files:**
- Create: `src/data/network.ts`
- Test: `src/data/network.test.ts`

**Interfaces:**
- Produces: `loadNetwork(deps?): Promise<{ live: boolean; validators: number; votes: { chain: ChainKey; index: number }[]; treasury: bigint }>`. `live` = the relay's `timestamp.now` is less than 30 s behind the browser clock. Votes = ongoing referenda on relay, Asset Hub and People. Treasury = free HEZ of the Asset Hub treasury account (`modlpy/trsry` + zero padding, encoded with prefix 42).

- [ ] **Step 1: Write the failing test**

```ts
// src/data/network.test.ts
import { describe, expect, it } from 'vitest';
import { loadNetwork } from './network';

const NOW = 1_800_000_000_000;
const fake = (chain: string) => Promise.resolve({
  query: {
    timestamp: { now: () => Promise.resolve({ toNumber: () => (chain === 'relay' ? NOW - 6_000 : NOW) }) },
    session: { validators: () => Promise.resolve(new Array(4)) },
    referenda: { referendumInfoFor: { entries: () => Promise.resolve(
      chain === 'assetHub' ? [[{ args: [{ toNumber: () => 3 }] }, { unwrap: () => ({ isOngoing: true }) }],
                               [{ args: [{ toNumber: () => 2 }] }, { unwrap: () => ({ isOngoing: false }) }]] : []) } },
    system: { account: () => Promise.resolve({ data: { free: { toBigInt: () => 99n } } }) },
  },
}) as never;

describe('loadNetwork', () => {
  it('reports liveness, validators, ongoing votes and treasury', async () => {
    const r = await loadNetwork({ getApi: fake, now: () => NOW });
    expect(r).toEqual({ live: true, validators: 4, votes: [{ chain: 'assetHub', index: 3 }], treasury: 99n });
  });
  it('reports not live when the last relay timestamp is older than 30 s', async () => {
    const r = await loadNetwork({ getApi: fake, now: () => NOW + 60_000 });
    expect(r.live).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/data/network.ts
import { encodeAddress } from '@pezkuwi/util-crypto';
import { getApi as realGetApi, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { NETWORK, type ChainKey } from '../config/network';
import { withTimeout } from '../lib/timeout';

const TREASURY = (() => {
  const id = new Uint8Array(32);
  id.set(new TextEncoder().encode('modlpy/trsry'));
  return encodeAddress(id, NETWORK.ss58);
})();

export async function loadNetwork(deps = { getApi: realGetApi, now: () => Date.now() }) {
  const chains: ChainKey[] = ['relay', 'assetHub', 'people'];
  const [relay, ah, ...rest] = await Promise.all(chains.map((c) => deps.getApi(c)));
  const apis = [relay, ah, ...rest];
  type Q = { query: {
    timestamp: { now(): Promise<{ toNumber(): number }> };
    session: { validators(): Promise<unknown[]> };
    referenda?: { referendumInfoFor: { entries(): Promise<[{ args: [{ toNumber(): number }] }, { unwrap(): { isOngoing: boolean } }][]> } };
    system: { account(a: string): Promise<{ data: { free: { toBigInt(): bigint } } }> };
  } };
  const [ts, vals, treasury, ...refs] = await withTimeout(Promise.all([
    (relay as never as Q).query.timestamp.now(),
    (relay as never as Q).query.session.validators(),
    (ah as never as Q).query.system.account(TREASURY),
    ...apis.map((a) => (a as never as Q).query.referenda?.referendumInfoFor.entries() ?? Promise.resolve([])),
  ]), REQUEST_TIMEOUT_MS) as [{ toNumber(): number }, unknown[], { data: { free: { toBigInt(): bigint } } }, ...Awaited<ReturnType<NonNullable<Q['query']['referenda']>['referendumInfoFor']['entries']>>[]];
  const votes = refs.flatMap((entries, i) =>
    entries.filter(([, v]) => v.unwrap().isOngoing).map(([k]) => ({ chain: chains[i], index: k.args[0].toNumber() })));
  return { live: deps.now() - ts.toNumber() < 30_000, validators: vals.length, votes, treasury: treasury.data.free.toBigInt() };
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Live check** — `loadNetwork()` against Zagros returns `live: true`, `validators: 4`.
- [ ] **Step 6: Commit** — `git commit -am "Load network liveness, validators, votes and treasury"`

---

### Task 10: App shell, home, footer, language picker

**Files:**
- Create: `src/App.tsx`, `src/ui/Layout.tsx`, `src/ui/BigButton.tsx`, `src/ui/Card.tsx`, `src/ui/StatusLight.tsx`, `src/ui/LanguagePicker.tsx`, `src/screens/Home.tsx`, `src/ui/icons.tsx`
- Test: `src/screens/Home.test.tsx`, `src/ui/Layout.test.tsx`

**Interfaces:**
- Consumes: `useAccount`, `loadNetwork`, `useAsync`, `setLanguage`, `LOCALES`.
- Produces: routes `/`, `/account`, `/account/open`, `/account/activity/:id`, `/payment`, `/citizenship`, `/network`; `<Card status="loading"|"ok"|"error"|"preparing" onRetry>`; `<BigButton to icon label>`; `<Amount value decimals symbol />` renders inside `<bdi>`; `<Addr value />` renders `shortAddress` inside `<bdi dir="ltr">`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/Home.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import Home from './Home';

vi.mock('../data/network', () => ({ loadNetwork: () => Promise.resolve({ live: true, validators: 4, votes: [], treasury: 0n }) }));

describe('Home', () => {
  it('shows the four big buttons with links', async () => {
    await i18n.changeLanguage('en');
    render(<MemoryRouter><AccountProvider><Home /></AccountProvider></MemoryRouter>);
    for (const [label, href] of [['My account', '/account'], ['Did my payment arrive?', '/payment'], ['Citizenship', '/citizenship'], ['Network', '/network']]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(await screen.findByText('The network is working')).toBeInTheDocument();
  });
});
```

```tsx
// src/ui/Layout.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '../i18n';
import { Addr } from './Layout';

describe('Layout', () => {
  it('flips the document to RTL for Sorani and keeps addresses LTR', () => {
    setLanguage('ckb');
    expect(document.documentElement.dir).toBe('rtl');
    render(<MemoryRouter><Addr value="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" /></MemoryRouter>);
    const el = screen.getByText('5Grwva…GKutQY');
    expect(el.tagName).toBe('BDI');
    expect(el).toHaveAttribute('dir', 'ltr');
    setLanguage('kmr');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AccountProvider } from './account/AccountContext';
import Layout from './ui/Layout';
import Home from './screens/Home';
import OpenAccount from './screens/OpenAccount';
import Account from './screens/Account';
import ActivityDetail from './screens/ActivityDetail';
import PaymentStatus from './screens/PaymentStatus';
import Citizenship from './screens/Citizenship';
import Network from './screens/Network';

export default function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="account" element={<Account />} />
            <Route path="account/open" element={<OpenAccount />} />
            <Route path="account/activity/:id" element={<ActivityDetail />} />
            <Route path="payment" element={<PaymentStatus />} />
            <Route path="citizenship" element={<Citizenship />} />
            <Route path="network" element={<Network />} />
          </Route>
        </Routes>
      </AccountProvider>
    </BrowserRouter>
  );
}
```

```tsx
// src/ui/Layout.tsx
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shortAddress } from '../lib/address';
import LanguagePicker from './LanguagePicker';

export const Addr = ({ value }: { value: string }) => <bdi dir="ltr" title={value}>{shortAddress(value)}</bdi>;

export default function Layout() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const home = useLocation().pathname === '/';
  return (
    <div className="page">
      <header className="top">
        {home ? <img src="/logo.svg" alt={t('app.name')} height={40} /> :
          <button className="back" onClick={() => nav(-1)} aria-label={t('app.back')}>‹ {t('app.back')}</button>}
        <LanguagePicker />
      </header>
      <main><Outlet /></main>
      <footer><a href="https://apps.pezkuwichain.io" rel="noopener">{t('app.experts')}</a></footer>
    </div>
  );
}
```

```tsx
// src/ui/LanguagePicker.tsx
import { useTranslation } from 'react-i18next';
import { LOCALES, setLanguage, type Locale } from '../i18n';
const NAMES: Record<Locale, string> = { kmr: 'Kurmancî', ckb: 'کوردی', tr: 'Türkçe', en: 'English', fa: 'فارسی', ar: 'العربية' };

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <select aria-label={t('app.language')} value={i18n.language} onChange={(e) => setLanguage(e.target.value as Locale)}>
      {LOCALES.map((l) => <option key={l} value={l}>{NAMES[l]}</option>)}
    </select>
  );
}
```

```tsx
// src/ui/BigButton.tsx
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
export const BigButton = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <Link className="big-button" to={to} aria-label={label}><span aria-hidden="true">{icon}</span><span>{label}</span></Link>
);
```

```tsx
// src/ui/Card.tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
type Status = 'loading' | 'ok' | 'error' | 'preparing';
export function Card({ title, status, onRetry, children }: { title: string; status: Status; onRetry?: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className={`card card-${status}`} aria-busy={status === 'loading'}>
      <h2>{title}</h2>
      {status === 'loading' && <p>{t('state.loading')}</p>}
      {status === 'preparing' && <p>{t('state.preparing')}</p>}
      {status === 'error' && <p>{t('state.error')} {onRetry && <button onClick={onRetry}>{t('state.retry')}</button>}</p>}
      {status === 'ok' && children}
    </section>
  );
}
```

```tsx
// src/ui/StatusLight.tsx
import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadNetwork } from '../data/network';
export default function StatusLight() {
  const { t } = useTranslation();
  const s = useAsync(loadNetwork, []);
  const key = s.status === 'loading' ? 'checking' : s.status === 'ok' && s.data!.live ? 'up' : 'down';
  return <p className={`light light-${key}`} role="status"><span aria-hidden="true">●</span> {t(`status.${key}`)}</p>;
}
```

```tsx
// src/screens/Home.tsx
import { useTranslation } from 'react-i18next';
import { BigButton } from '../ui/BigButton';
import StatusLight from '../ui/StatusLight';
import { IconWallet, IconArrow, IconId, IconSignal } from '../ui/icons';

export default function Home() {
  const { t } = useTranslation();
  return (
    <>
      <nav className="grid-2x2">
        <BigButton to="/account" icon={<IconWallet />} label={t('home.account')} />
        <BigButton to="/payment" icon={<IconArrow />} label={t('home.payment')} />
        <BigButton to="/citizenship" icon={<IconId />} label={t('home.citizenship')} />
        <BigButton to="/network" icon={<IconSignal />} label={t('home.network')} />
      </nav>
      <StatusLight />
    </>
  );
}
```

`src/ui/icons.tsx`: four inline SVG components (`IconWallet`, `IconArrow`, `IconId`, `IconSignal`), 48×48, `stroke="currentColor"`, `aria-hidden`. Add the layout CSS to `theme.css`: `.grid-2x2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:16px }`, `.big-button { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background:var(--green); color:var(--on-green); font-size:20px; font-weight:600; border-radius:var(--radius); text-decoration:none }`, `.top { display:flex; justify-content:space-between; align-items:center; padding:16px }`, `footer { text-align:center; padding:24px 16px; font-size:15px }`, `.card { background:var(--surface); border-radius:var(--radius); padding:16px; margin:16px }`, `.light-up span { color:var(--green) } .light-down span { color:var(--red) }`. Use logical properties (`margin-inline-start`) everywhere so RTL mirrors without extra rules.

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add app shell, home grid, status light and language picker"`

---

### Task 11: Opening an account (paste, QR, extension, WalletConnect)

**Files:**
- Create: `src/screens/OpenAccount.tsx`, `src/account/connectors/extension.ts`, `src/account/connectors/walletconnect.ts`, `src/account/connectors/qr.ts`
- Test: `src/screens/OpenAccount.test.tsx`, `src/account/connectors/walletconnect.test.ts`

**Interfaces:**
- Produces: `extensionAccounts(): Promise<string[]>` (throws `NoWalletError` when no extension, `RejectedError` on refusal); `walletConnectAccounts(onUri: (uri: string) => void): Promise<string[]>`; `wcNamespaces(): { polkadot: { methods: string[]; chains: string[]; events: string[] } }`; `scanQr(video: HTMLVideoElement, signal: AbortSignal): Promise<string>`.
- `OpenAccount` calls `useAccount().open(address)` then navigates to `/account` (or the `?next=` route).

- [ ] **Step 1: Write the failing tests**

```ts
// src/account/connectors/walletconnect.test.ts
import { describe, expect, it } from 'vitest';
import { wcNamespaces } from './walletconnect';

describe('walletconnect namespaces', () => {
  it('requests accounts only — never a signing method', () => {
    const ns = wcNamespaces();
    expect(ns.polkadot.methods).toEqual([]);
    expect(ns.polkadot.chains).toEqual([
      'polkadot:1b0b4727bbb5e44ed587d1056b4ad537',
      'polkadot:063f739077881df9f291548de301b2e1',
      'polkadot:c72b38f36affaeb2661018b201c2be02',
    ]);
  });
});
```

```tsx
// src/screens/OpenAccount.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import OpenAccount from './OpenAccount';

const ui = () => render(
  <MemoryRouter initialEntries={['/account/open']}><AccountProvider><Routes>
    <Route path="/account/open" element={<OpenAccount />} />
    <Route path="/account" element={<p>ACCOUNT PAGE</p>} />
  </Routes></AccountProvider></MemoryRouter>);

describe('OpenAccount', () => {
  it('offers the three ways in', async () => {
    await i18n.changeLanguage('en'); ui();
    for (const n of ['Open with my wallet', 'Scan QR', 'Paste address']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
  });
  it('shows a plain error for an invalid paste and opens a valid one', async () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Paste address' }));
    const box = screen.getByPlaceholderText('Paste your address here');
    fireEvent.change(box, { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This is not a valid address');
    fireEvent.change(box, { target: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('ACCOUNT PAGE')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement connectors**

```ts
// src/account/connectors/extension.ts
import { web3Accounts, web3Enable } from '@pezkuwi/extension-dapp';
export class NoWalletError extends Error {}
export class RejectedError extends Error {}

export async function extensionAccounts(): Promise<string[]> {
  const ext = await web3Enable('Pezkuwi Explorer');
  if (ext.length === 0) throw new NoWalletError();
  const accounts = await web3Accounts();
  if (accounts.length === 0) throw new RejectedError();
  return accounts.map((a) => a.address);
}
```

```ts
// src/account/connectors/walletconnect.ts
import SignClient from '@walletconnect/sign-client';
import { NETWORK, caip2 } from '../../config/network';
import { RejectedError } from './extension';

// Accounts only. No signing method is requested, so the session cannot be asked to sign.
export const wcNamespaces = () => ({
  polkadot: { methods: [] as string[], chains: [caip2('relay'), caip2('assetHub'), caip2('people')], events: ['accountsChanged'] },
});

export async function walletConnectAccounts(onUri: (uri: string) => void): Promise<string[]> {
  const client = await SignClient.init({
    projectId: NETWORK.walletConnectProjectId,
    metadata: { name: 'Pezkuwi Explorer', description: 'Pezkuwi Explorer', url: 'https://explorer.pezkuwichain.io', icons: ['https://explorer.pezkuwichain.io/icon-192.png'] },
  });
  const { uri, approval } = await client.connect({ optionalNamespaces: wcNamespaces() });
  if (uri) onUri(uri);
  const session = await approval().catch(() => { throw new RejectedError(); });
  const addrs = Object.values(session.namespaces).flatMap((n) => n.accounts).map((a) => a.split(':')[2]);
  await client.disconnect({ topic: session.topic, reason: { code: 6000, message: 'address read' } }).catch(() => {});
  return [...new Set(addrs)];
}
```

```ts
// src/account/connectors/qr.ts
import jsQR from 'jsqr';
// Decodes in the browser; frames never leave the device.
export async function scanQr(video: HTMLVideoElement, signal: AbortSignal): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream; await video.play();
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  try {
    while (!signal.aborted) {
      await new Promise((r) => requestAnimationFrame(r));
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      if (!canvas.width) continue;
      ctx.drawImage(video, 0, 0);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      // Wallet QR codes may be "substrate:<address>:<pubkey>:<name>"; take the address part.
      if (code?.data) return code.data.startsWith('substrate:') ? code.data.split(':')[1] : code.data;
    }
    throw new DOMException('aborted', 'AbortError');
  } finally { stream.getTracks().forEach((t) => t.stop()); }
}
```

- [ ] **Step 4: Implement the screen**

```tsx
// src/screens/OpenAccount.tsx
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';
import { extensionAccounts, NoWalletError } from '../account/connectors/extension';
import { walletConnectAccounts } from '../account/connectors/walletconnect';
import { scanQr } from '../account/connectors/qr';

type Mode = 'menu' | 'paste' | 'scan' | 'pick' | 'wc';

export default function OpenAccount() {
  const { t } = useTranslation();
  const { open } = useAccount();
  const nav = useNavigate();
  const next = useSearchParams()[0].get('next') ?? '/account';
  const [mode, setMode] = useState<Mode>('menu');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);

  const finish = (a: string) => (open(a) ? nav(next, { replace: true }) : setError(t('open.invalid')));
  const pickFrom = (list: string[]) => (list.length === 1 ? finish(list[0]) : (setChoices(list), setMode('pick')));

  const wallet = async () => {
    setError(null);
    try { pickFrom(await extensionAccounts()); return; }
    catch (e) { if (!(e instanceof NoWalletError)) { setError(t('open.rejected')); return; } }
    try { setMode('wc'); pickFrom(await walletConnectAccounts(setWcUri)); }
    catch { setMode('menu'); setError(t('open.noWallet')); }
  };
  const scan = async () => {
    setMode('scan'); abort.current = new AbortController();
    try { finish(await scanQr(video.current!, abort.current.signal)); } catch { setMode('menu'); }
  };

  return (
    <div className="stack">
      <h1>{t('open.title')}</h1>
      {mode === 'menu' && <>
        <button className="big" onClick={wallet}>{t('open.wallet')}</button>
        <button className="big" onClick={scan}>{t('open.scan')}</button>
        <button className="big" onClick={() => setMode('paste')}>{t('open.paste')}</button>
      </>}
      {mode === 'paste' && <>
        <textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('open.pastePlaceholder')} rows={3} />
        <button className="big" onClick={() => finish(text)}>{t('open.go')}</button>
      </>}
      {mode === 'scan' && <video ref={video} playsInline muted className="scanner" />}
      {mode === 'wc' && wcUri && <a className="big button" href={`pezkuwiwallet://wc?uri=${encodeURIComponent(wcUri)}`}>{t('open.wallet')}</a>}
      {mode === 'pick' && choices.map((a) => <button key={a} className="big" onClick={() => finish(a)}><bdi dir="ltr">{a}</bdi></button>)}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

The deep-link scheme `pezkuwiwallet://wc` must be verified against the Pezkuwi Wallet app's registered scheme (Android manifest / iOS Info.plist in the wallet repos) before Task 18; replace it with the registered one.

- [ ] **Step 5: Run tests** — PASS.
- [ ] **Step 6: Commit** — `git commit -am "Open an account by paste, QR, extension or WalletConnect"`

---

### Task 12: Account screen and activity detail

**Files:**
- Create: `src/screens/Account.tsx`, `src/screens/ActivityDetail.tsx`, `src/ui/Amount.tsx`
- Test: `src/screens/Account.test.tsx`

**Interfaces:**
- Consumes: `useAccount`, `loadBalances`, `loadActivity`, `NotIndexedError`, `Card`, `Addr`, `formatAmount`, `relativeTime`.
- Activity rows link to `/account/activity/:id` passing the `Activity` in router state; the detail page reads it from `useLocation().state` and, when missing (reload), redirects to `/account`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/Account.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
vi.mock('../data/balances', () => ({ loadBalances: () => Promise.resolve([{ symbol: 'HEZ', decimals: 12, amount: 5_000_000_000_000n }]) }));
vi.mock('../data/history', async (orig) => {
  const m = await orig<typeof import('../data/history')>();
  return { ...m, loadActivity: () => Promise.reject(new m.NotIndexedError()) };
});

describe('Account', () => {
  it('shows balances and an honest "being prepared" history when not indexed', async () => {
    await i18n.changeLanguage('en'); storage.set('account', ALICE);
    const { default: Account } = await import('./Account');
    render(<MemoryRouter><AccountProvider><Account /></AccountProvider></MemoryRouter>);
    expect(await screen.findByText('5 HEZ')).toBeInTheDocument();
    expect(await screen.findByText('This section is being prepared.')).toBeInTheDocument();
  });
  it('a failing balance source shows the error card, not a spinner', async () => {
    vi.doMock('../data/balances', () => ({ loadBalances: () => Promise.reject(new Error('down')) }));
    vi.resetModules();
    const { default: Account } = await import('./Account');
    render(<MemoryRouter><AccountProvider><Account /></AccountProvider></MemoryRouter>);
    expect(await screen.findByText(/This could not be loaded/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/ui/Amount.tsx
import { useTranslation } from 'react-i18next';
import { formatAmount } from '../lib/format';
export const Amount = ({ value, decimals, symbol }: { value: bigint; decimals: number; symbol: string }) => {
  const { i18n } = useTranslation();
  return <bdi>{formatAmount(value, decimals, symbol, i18n.language)}</bdi>;
};
```

```tsx
// src/screens/Account.tsx
import { Link, Navigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadBalances } from '../data/balances';
import { loadActivity, NotIndexedError, type Activity } from '../data/history';
import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Addr } from '../ui/Layout';
import { Amount } from '../ui/Amount';
import { relativeTime } from '../lib/format';

export default function Account() {
  const { t, i18n } = useTranslation();
  const { address, forget } = useAccount();
  const balances = useAsync(() => loadBalances(address!), [address]);
  const [hist, setHist] = useState<{ status: 'loading' | 'ok' | 'error' | 'preparing'; data?: Activity[] }>({ status: 'loading' });
  useEffect(() => {
    if (!address) return;
    setHist({ status: 'loading' });
    loadActivity(address).then((data) => setHist({ status: 'ok', data }),
      (e) => setHist({ status: e instanceof NotIndexedError ? 'preparing' : 'error' }));
  }, [address]);
  if (!address) return <Navigate to="/account/open" replace />;
  const now = Date.now() / 1000;
  return (
    <>
      <p className="who"><Addr value={address} /></p>
      <Card title={t('account.total')} status={balances.status} onRetry={balances.retry}>
        <ul className="holdings">{balances.data?.map((h) => <li key={h.symbol}><Amount value={h.amount} decimals={h.decimals} symbol={h.symbol} /></li>)}</ul>
      </Card>
      <Card title={t('account.activity')} status={hist.status}>
        {hist.data?.length === 0 && <p>{t('account.empty')}</p>}
        <ul className="timeline">{hist.data?.map((a) => (
          <li key={a.id}><Link to={`/account/activity/${encodeURIComponent(a.id)}`} state={a}>
            {a.direction === 'other' || !a.counterparty ? <Amount value={a.amount} decimals={a.decimals} symbol={a.symbol} /> :
              <Trans i18nKey={a.direction === 'sent' ? 'account.sent' : 'account.received'}
                components={{ amount: <Amount value={a.amount} decimals={a.decimals} symbol={a.symbol} />, who: <Addr value={a.counterparty} /> }} />}
            {' · '}{relativeTime(a.when, now, i18n.language)} {a.ok ? '✅' : '❌'}
          </Link></li>))}</ul>
      </Card>
      <button className="quiet" onClick={forget}>{t('account.forget')}</button>
    </>
  );
}
```

`<Trans>` places the amount and the counterparty in each language's own word order; the locale strings carry `<amount/>` and `<who/>` tags (Task 1).

```tsx
// src/screens/ActivityDetail.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Activity } from '../data/history';
import { Amount } from '../ui/Amount';
import { Addr } from '../ui/Layout';
import { NETWORK } from '../config/network';

export default function ActivityDetail() {
  const { t, i18n } = useTranslation();
  const a = useLocation().state as Activity | null;
  if (!a) return <Navigate to="/account" replace />;
  return (
    <div className="stack detail">
      <p className={`big-mark ${a.ok ? 'ok' : 'failed'}`} aria-label={t(a.ok ? 'account.ok' : 'account.failed')}>{a.ok ? '✅' : '❌'}</p>
      <h1><Amount value={a.amount} decimals={a.decimals} symbol={a.symbol} /></h1>
      {a.counterparty && <p>{t(a.direction === 'sent' ? 'account.to' : 'account.from')}: <Addr value={a.counterparty} /></p>}
      <p>{t('account.when')}: {new Date(a.when * 1000).toLocaleString(i18n.language)}</p>
      <p>{t('account.fee')}: <Amount value={a.fee} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add account balances, activity timeline and detail"`

---

### Task 13: Payment status screen

**Files:**
- Create: `src/screens/PaymentStatus.tsx`
- Test: `src/screens/PaymentStatus.test.tsx`

**Interfaces:**
- Consumes: `findPayment`, `indexerLag`, `NotIndexedError`, `scanQr`.
- Result mapping: `arrived → ✅ payment.arrived`; `failed → ❌ payment.notArrived + payment.notArrivedText`; `notFound` with `indexerLag() > 20 → ⏳ payment.onTheWay`; `notFound` otherwise → `payment.notFound`; `NotIndexedError → state.preparing`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/PaymentStatus.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';

const find = vi.fn(); const lag = vi.fn();
vi.mock('../data/history', async (o) => ({ ...(await o<typeof import('../data/history')>()), findPayment: (q: string) => find(q), indexerLag: () => lag() }));
const CODE = '0x' + 'ab'.repeat(32);

async function ask() {
  await i18n.changeLanguage('en');
  const { default: P } = await import('./PaymentStatus');
  render(<MemoryRouter><P /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText('Paste the transaction code or an address'), { target: { value: CODE } });
  fireEvent.submit(screen.getByRole('search'));
}

describe('PaymentStatus', () => {
  it('arrived', async () => { find.mockResolvedValue({ status: 'arrived', activity: { counterparty: null } }); await ask(); expect(await screen.findByText('Arrived')).toBeInTheDocument(); });
  it('failed explains the money stayed', async () => { find.mockResolvedValue({ status: 'failed' }); await ask(); expect(await screen.findByText(/Your money is still in your account/)).toBeInTheDocument(); });
  it('not found while the indexer lags means on its way', async () => { find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(50); await ask(); expect(await screen.findByText('On its way')).toBeInTheDocument(); });
  it('not found with a current indexer says so plainly', async () => { find.mockResolvedValue({ status: 'notFound' }); lag.mockResolvedValue(0); await ask(); expect(await screen.findByText(/We could not find this payment yet/)).toBeInTheDocument(); });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/screens/PaymentStatus.tsx
import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { findPayment, indexerLag, NotIndexedError } from '../data/history';
import { Addr } from '../ui/Layout';

type Result = 'arrived' | 'failed' | 'onTheWay' | 'notFound' | 'preparing' | 'error' | 'invalid';

export default function PaymentStatus() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ r: Result; who?: string | null } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setRes(null);
    try {
      const p = await findPayment(q);
      if (p.status === 'notFound') setRes({ r: (await indexerLag()) > 20 ? 'onTheWay' : 'notFound' });
      else setRes({ r: p.status, who: p.activity?.counterparty });
    } catch (err) {
      setRes({ r: err instanceof NotIndexedError ? 'preparing' : err instanceof Error && err.message === 'not a code or address' ? 'invalid' : 'error' });
    } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <h1>{t('payment.title')}</h1>
      <form role="search" onSubmit={submit}>
        <textarea dir="ltr" rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('payment.placeholder')} />
        <button className="big" type="submit" disabled={busy}>{busy ? t('state.loading') : t('open.go')}</button>
      </form>
      {res && <div className={`answer answer-${res.r}`} role="status">
        {res.r === 'arrived' && <><p className="big-mark">✅</p><h2>{t('payment.arrived')}</h2>{res.who && <p><Trans i18nKey="payment.arrivedText" components={{ who: <Addr value={res.who} /> }} /></p>}</>}
        {res.r === 'failed' && <><p className="big-mark">❌</p><h2>{t('payment.notArrived')}</h2><p>{t('payment.notArrivedText')}</p></>}
        {res.r === 'onTheWay' && <><p className="big-mark">⏳</p><h2>{t('payment.onTheWay')}</h2></>}
        {res.r === 'notFound' && <p>{t('payment.notFound')}</p>}
        {res.r === 'preparing' && <p>{t('state.preparing')}</p>}
        {res.r === 'invalid' && <p role="alert">{t('open.invalid')}</p>}
        {res.r === 'error' && <p>{t('state.error')}</p>}
      </div>}
    </div>
  );
}
```


- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add payment status screen"`

---

### Task 14: Citizenship screen

**Files:**
- Create: `src/screens/Citizenship.tsx`
- Test: `src/screens/Citizenship.test.tsx`

**Interfaces:**
- Consumes: `useAccount`, `loadCitizenship`, `Stage`, `Card`. With no open account, renders the three entry buttons by navigating to `/account/open?next=/citizenship`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/Citizenship.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { AccountProvider } from '../account/AccountContext';
import { storage } from '../lib/storage';

vi.mock('../data/citizenship', () => ({ loadCitizenship: () => Promise.resolve({ stage: 'approved', roles: ['Welati'], trust: 12n }) }));

describe('Citizenship', () => {
  it('marks the current step and shows roles and trust', async () => {
    await i18n.changeLanguage('en'); storage.set('account', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    const { default: C } = await import('./Citizenship');
    render(<MemoryRouter><AccountProvider><C /></AccountProvider></MemoryRouter>);
    expect(await screen.findByText('Approved')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/screens/Citizenship.tsx
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadCitizenship } from '../data/citizenship';
import { Card } from '../ui/Card';

const STEPS = ['applied', 'approved', 'citizen'] as const;

export default function Citizenship() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const s = useAsync(() => loadCitizenship(address!), [address]);
  if (!address) return <Navigate to="/account/open?next=/citizenship" replace />;
  const stage = s.data?.stage;
  return (
    <>
      <h1>{t('citizenship.title')}</h1>
      <Card title={t('citizenship.title')} status={s.status} onRetry={s.retry}>
        {stage === 'notStarted' && <p>{t('citizenship.notStarted')}</p>}
        {stage === 'revoked' && <p>{t('citizenship.revoked')}</p>}
        {stage && STEPS.includes(stage as never) && (
          <ol className="steps">{STEPS.map((st) => (
            <li key={st} className={STEPS.indexOf(st) <= STEPS.indexOf(stage as never) ? 'done' : ''}
                aria-current={st === stage ? 'step' : undefined}>{t(`citizenship.${st}`)}</li>))}</ol>)}
      </Card>
      <Card title={t('citizenship.roles')} status={s.status}>
        {s.data?.roles.length ? <ul className="badges">{s.data.roles.map((r) => <li key={r}>{t(`tiki.${r}`)}</li>)}</ul> : <p>{t('citizenship.noRoles')}</p>}
      </Card>
      <Card title={t('citizenship.trust')} status={s.status}><p className="big-number"><bdi>{s.data?.trust.toString()}</bdi></p></Card>
    </>
  );
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add citizenship screen"`

---

### Task 15: Network screen

**Files:**
- Create: `src/screens/Network.tsx`
- Test: `src/screens/Network.test.tsx`

**Interfaces:**
- Consumes: `loadNetwork`, `Card`, `Amount`, `NETWORK`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/Network.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';

vi.mock('../data/network', () => ({ loadNetwork: () => Promise.resolve({ live: true, validators: 4, votes: [], treasury: 7_000_000_000_000n }) }));

describe('Network', () => {
  it('shows the light, validators, treasury and the vote hint', async () => {
    await i18n.changeLanguage('en');
    const { default: N } = await import('./Network');
    render(<MemoryRouter><N /></MemoryRouter>);
    expect(await screen.findByText('The network is working')).toBeInTheDocument();
    expect(screen.getByText('4 active')).toBeInTheDocument();
    expect(screen.getByText('7 HEZ')).toBeInTheDocument();
    expect(screen.getByText('No active votes right now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'To vote, use apps.pezkuwichain.io' })).toHaveAttribute('href', 'https://apps.pezkuwichain.io/#/referenda');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/screens/Network.tsx
import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadNetwork } from '../data/network';
import { Card } from '../ui/Card';
import { Amount } from '../ui/Amount';
import { NETWORK } from '../config/network';

export default function Network() {
  const { t } = useTranslation();
  const s = useAsync(loadNetwork, []);
  const d = s.data;
  return (
    <>
      <h1>{t('network.title')}</h1>
      <p className={`light light-${s.status === 'ok' && d!.live ? 'up' : s.status === 'loading' ? 'checking' : 'down'}`} role="status">
        <span aria-hidden="true">●</span> {t(s.status === 'loading' ? 'status.checking' : s.status === 'ok' && d!.live ? 'status.up' : 'status.down')}
      </p>
      <Card title={t('network.votes')} status={s.status} onRetry={s.retry}>
        {d?.votes.length ? <p><bdi>{d.votes.length}</bdi></p> : <p>{t('network.noVotes')}</p>}
        <a href="https://apps.pezkuwichain.io/#/referenda" rel="noopener">{t('network.voteHint')}</a>
      </Card>
      <Card title={t('network.treasury')} status={s.status}>
        {d && <p className="big-number"><Amount value={d.treasury} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></p>}
      </Card>
      <Card title={t('network.validators')} status={s.status}>
        {d && <p>{t('network.validatorsActive', { count: d.validators })}</p>}
      </Card>
    </>
  );
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add network screen"`

---

### Task 16: PWA, icons, security headers reference

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/logo.svg`, `public/icon-192.png`, `public/icon-512.png`, `deploy/nginx-explorer.conf`
- Test: `src/pwa.test.ts`

**Interfaces:**
- Produces: `dist/manifest.webmanifest` with `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color: "#14a05a"`, icons 192/512.

- [ ] **Step 1: Write the failing test**

```ts
// src/pwa.test.ts
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('build output', () => {
  it('emits a standalone manifest and a service worker', () => {
    execSync('npx vite build', { stdio: 'ignore' });
    const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
    expect(m).toMatchObject({ start_url: '/', display: 'standalone', theme_color: '#14a05a' });
    expect(readFileSync('dist/sw.js', 'utf8').length).toBeGreaterThan(0);
  }, 120_000);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    // Chain data is never cached: only the app shell is.
    workbox: { navigateFallback: '/index.html', runtimeCaching: [] },
    manifest: {
      name: 'Pezkuwi Explorer', short_name: 'Explorer', start_url: '/', display: 'standalone',
      background_color: '#ffffff', theme_color: '#14a05a',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    },
  })],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
```

`src/test-setup.ts`: `import '@testing-library/jest-dom/vitest';`. Take `logo.svg` and the icons from the pezkuwichain.io landing assets (same mark).

```nginx
# deploy/nginx-explorer.conf — reference copy of the production vhost (domain only).
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name explorer.pezkuwichain.io;
    ssl_certificate     /etc/letsencrypt/live/explorer.pezkuwichain.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/explorer.pezkuwichain.io/privkey.pem;
    root /var/www/explorer;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:; connect-src 'self' wss://zagros-rpc.pezkuwichain.io wss://zagros-asset-hub-rpc.pezkuwichain.io wss://zagros-people-rpc.pezkuwichain.io https://subquery.pezkuwichain.io wss://relay.walletconnect.com wss://relay.walletconnect.org https://*.walletconnect.com https://*.walletconnect.org; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" always;
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location = /sw.js { add_header Cache-Control "no-cache"; }
    location / { try_files $uri /index.html; add_header Cache-Control "no-cache"; }
}
```

The `connect-src` list must be updated in the same commit as any change to `src/config/network.ts`; add a test in `src/config/network.test.ts`:

```ts
import { readFileSync } from 'node:fs';
it('every configured origin is allowed by the deployed CSP', () => {
  const csp = readFileSync('deploy/nginx-explorer.conf', 'utf8');
  for (const c of Object.values(NETWORK.chains)) for (const u of c.rpc) expect(csp).toContain(u);
  for (const u of Object.values(NETWORK.history)) if (u) expect(csp).toContain(new URL(u).origin);
});
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "Add PWA manifest, icons and host vhost reference"`

---

### Task 17: Deploy pipeline and host setup

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Secrets (repository): `DEPLOY_SSH_KEY` (private key), `DEPLOY_HOST` (host name), `DEPLOY_KNOWN_HOSTS` (pinned host key line), `VITE_WALLETCONNECT_PROJECT_ID`.

- [ ] **Step 1: Host preparation (operator, with Serok's approval for each write)**
  1. Create user `explorer-deploy` with no shell login except `rrsync`: `useradd -m -s /bin/sh explorer-deploy`; `mkdir -p /var/www/explorer && chown explorer-deploy: /var/www/explorer`.
  2. Generate an ed25519 key pair locally; append (`>>`, never overwrite) to `/home/explorer-deploy/.ssh/authorized_keys`: `command="/usr/bin/rrsync /var/www/explorer",restrict <public key>`. Test a new connection before closing the existing one.
  3. Replace the coming-soon server block in `/etc/nginx/sites-available/explorer.conf` with `deploy/nginx-explorer.conf` (keep the port-80 ACME block); `nginx -t && systemctl reload nginx`.
  4. Store the private key under `res/secrets/explorer-deploy/` and in the repository secrets; record it in `res/SECRETS_INDEX.md`.
  5. WalletConnect: reuse the Pezkuwi web project id already used by pwap/rewshenbir; Serok adds `https://explorer.pezkuwichain.io` to that project's allowed domains in the WalletConnect dashboard. Without it the wallet button falls through to its "no wallet" message.

- [ ] **Step 2: Write the workflow**

```yaml
# .github/workflows/deploy.yml
name: deploy
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read }
concurrency: { group: deploy, cancel-in-progress: false }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci && npm run check-deps && npm test && npm run build
        env: { VITE_WALLETCONNECT_PROJECT_ID: '${{ secrets.VITE_WALLETCONNECT_PROJECT_ID }}' }
      - name: upload
        env: { KEY: '${{ secrets.DEPLOY_SSH_KEY }}', HOSTS: '${{ secrets.DEPLOY_KNOWN_HOSTS }}', HOST: '${{ secrets.DEPLOY_HOST }}' }
        run: |
          install -m 600 /dev/null ~/key && printf '%s\n' "$KEY" > ~/key
          mkdir -p ~/.ssh && printf '%s\n' "$HOSTS" > ~/.ssh/known_hosts
          rsync -rlz --delete-after -e "ssh -i ~/key" dist/ "explorer-deploy@$HOST:"
      - name: verify
        run: curl -fsS https://explorer.pezkuwichain.io/ | grep -q '<div id="root">'
```

`--delete-after` only removes files under `/var/www/explorer` (rrsync-confined); `index.html` is replaced last by rsync's default ordering being file-by-file, so the hashed `/assets/*` of the new build exist before the new `index.html` references them.

- [ ] **Step 3: Dry run** — `workflow_dispatch` on a branch with `rsync --dry-run`; confirm the file list is only `dist/` contents.
- [ ] **Step 4: Commit** — `git commit -am "Add deploy workflow"`

---

### Task 18: End-to-end smoke, real phones, go-live

**Files:**
- Create: `e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify: `.github/workflows/ci.yml` (add `e2e` job on `push` to `main` and nightly)

- [ ] **Step 1: Write the smoke test**

```ts
// e2e/smoke.spec.ts
import { expect, test } from '@playwright/test';
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const CITIZEN = process.env.SMOKE_ADDRESS!; // a Zagros address with a balance, from identityKyc.kycStatuses

test('home renders and the network light resolves', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('link')).toHaveCount(5); // four buttons + experts link
  await expect(page.getByRole('status')).not.toHaveText(/…/, { timeout: 20_000 });
});

test('a pasted address shows a HEZ balance', async ({ page }) => {
  await page.goto(`${BASE}/account/open`);
  await page.getByRole('button').nth(2).click();
  await page.locator('textarea').fill(CITIZEN);
  await page.getByRole('button').last().click();
  await expect(page.getByText(/HEZ/)).toBeVisible({ timeout: 20_000 });
});

test('mobile viewport has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(BASE);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(360);
});
```

- [ ] **Step 2: Run locally against a preview build** — `npm run build && npx vite preview & SMOKE_ADDRESS=<addr> npx playwright test` → PASS.
- [ ] **Step 3: Real phones** — on iOS Safari and Android Chrome: open each screen in `kmr` and `ckb`; paste, QR (scan the Pezkuwi Wallet receive QR), "Open with my wallet" through Pezkuwi Wallet. Record results in `docs/release-checklist.md` with date and device. If Pezkuwi Wallet refuses a session with no methods, record the exact error and stop: that is a wallet-side change for the wallet session, not a reason to request a signing method here.
- [ ] **Step 4: Measure the TTS service on the same host before and after** — 10 synthesis requests of the same text to `kurdishtts.dks.news`, median latency before go-live and after; a regression over 10 % blocks go-live.
- [ ] **Step 5: Go-live** — merge to `main` (Serok approves the PR); the deploy workflow publishes; `curl -sI https://explorer.pezkuwichain.io/` shows the CSP header; the smoke job passes against `BASE_URL=https://explorer.pezkuwichain.io`.
- [ ] **Step 6: Commit** — `git commit -am "Add end-to-end smoke tests"`

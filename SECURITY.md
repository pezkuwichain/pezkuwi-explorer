# Security Policy

## Reporting a vulnerability

Report security issues **privately** — do not open a public issue.

- Use GitHub's **Report a vulnerability** (Security → Advisories), or
- e-mail **info@pezkuwichain.io** (privacy questions: **privacy@pezkuwichain.io**).

We aim to acknowledge within 72 hours. i-Wallet issues that could expose keys or move funds are handled first.

## Scope

- **explorer.pezkuwichain.io** is a static site: no server code, no database, no secrets on the host.
- **i-Wallet** (`/i-wallet`, short address `cuzdan.pex.network`) is a non-custodial browser wallet. The key, the
  backup words (both encrypted with the user's password: scrypt + xsalsa20-poly1305) and the optional Face ID record
  (WebAuthn PRF) stay in the browser's IndexedDB. Each signature decrypts a fresh key pair and locks it before
  waiting on the chain; the wallet auto-locks by wall clock (5 min idle, 60 s in the background).

## Secrets handling

- **No secret ever lives in git.**
- The deploy key is a secret of the GitHub `production` environment, used only by `.github/workflows/deploy.yml`;
  on the host it is restricted (rrsync) to the site directory.

## Hardening

- nginx sends a strict Content-Security-Policy (`deploy/nginx-explorer.conf`: self, the PezkuwiChain RPC and indexer
  origins, WalletConnect), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and
  `frame-ancestors 'none'`.
- No analytics, no trackers, no third-party fonts or scripts.
- Dependencies: Dependabot (weekly, never auto-merged); CodeQL on every pull request; `npm run check-deps`.

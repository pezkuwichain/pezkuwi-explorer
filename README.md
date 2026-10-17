# Pezkuwi Explorer

**explorer.pezkuwichain.io** — PezkuwiChain for everyone, in six languages (Kurmancî by default, Soranî, Türkçe,
English, فارسی, العربية).

- **Home, Account, Hevwelatî (citizenship), Network:** balances, recent activity, "did my payment arrive?",
  citizenship status and the citizen card, network health. Read-only; mainnet by default, Zagros testnet selectable
  on the Network tab.
- **i-Wallet** (`/i-wallet`, short address **cuzdan.pex.network**): a non-custodial browser wallet for iPhone users
  until the Pezkuwi Wallet ships on the App Store — create or import (12/24 words), send HEZ / PEZ / USDT per
  network, citizenship application and referrals. A hot wallet: for small amounts.

## Develop

```sh
npm ci
npm run dev          # local site
npm run typecheck && npm run lint && npm test && npm run build
npx playwright test e2e/iwallet.spec.ts   # i-Wallet end to end (chromium + webkit)
```

Node ≥ 24. Pezkuwi packages only (`@pezkuwi/*`).

## Layout

| path | what |
|---|---|
| `src/config/network.ts` | mainnet / Zagros configs and the switch |
| `src/config/iwallet-network.ts` | i-Wallet's mainnet config (the only file that changes at a genesis reset) |
| `src/iwallet/` | i-Wallet (loaded on demand) |
| `src/legal/` | Privacy and Terms pages, per language |
| `src/i18n/locales/` | the six locale files; open wording questions in `docs/i18n-review.md` |
| `deploy/` | reference nginx vhosts (CSP lives here) |
| `docs/deploy.md` | deploy and launch checklist |

## Contributing

Pull requests only (direct pushes to `main` are blocked); `build` and `iwallet-e2e` must pass; squash merge.
Security reports: see [SECURITY.md](SECURITY.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).

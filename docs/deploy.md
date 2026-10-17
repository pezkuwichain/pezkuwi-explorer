# Deploy

`.github/workflows/deploy.yml` runs on push to `main` (and manually). It runs the CI gates, builds, uploads `dist/` over rsync/SSH, then checks https://explorer.pezkuwichain.io/ serves the new hashed entry script and sends a Content-Security-Policy header.

## Required setup
In GitHub: Settings, Environments, `production`, Deployment branches = `main` only. This is the real security boundary; the job-level `if: github.ref == 'refs/heads/main'` is a second guard. The four secrets below must be ENVIRONMENT secrets of `production` (not repository secrets).

Dry run: run the workflow manually with `dry_run` enabled; every rsync pass uses `--dry-run --itemize-changes` and verification is skipped.

## Secrets (environment `production`)
- `DEPLOY_SSH_KEY`: private ed25519 key of the deploy user.
- `DEPLOY_HOST`: host name of the web server.
- `DEPLOY_KNOWN_HOSTS`: pinned host key line(s) (`ssh-keyscan` output, verified out of band). Host checking is strict.
- `VITE_WALLETCONNECT_PROJECT_ID`: WalletConnect project id (the domain explorer.pezkuwichain.io must be allowed in that project).

## Host confinement
The deploy user has no usable shell; its `authorized_keys` entry is
`command="/usr/bin/rrsync /var/www/explorer",restrict <public key>`, so the key can only run rsync inside the web root. The workflow therefore uses the module root (`explorer-deploy@$HOST:`) as destination, and `--delete-after` cannot touch anything outside it.

## Upload order
1. All files except `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest` (no delete).
2. Those four entry files.
3. A final `--delete-after` pass removes stale files.

## Enabling history (owner, after the indexer has caught up)
`deploy/nginx-explorer.conf` is a reference copy; the host's vhost is installed by hand. In this order:
1. Create `/etc/nginx/conf.d/explorer-history.conf` (http context) containing
   `limit_req_zone $binary_remote_addr zone=explorer_history:1m rate=5r/s;`.
   Without it the vhost's `limit_req zone=explorer_history` fails `nginx -t`.
2. Install the vhost with the `location = /history/assethub` block, then `nginx -t && systemctl reload nginx`.
3. Check: a GET to `https://explorer.pezkuwichain.io/history/assethub` answers 403, and a POST of
   `{"query":"{_metadata{lastProcessedHeight targetHeight}}"}` answers the indexer's metadata.
4. Set `history.assetHub = ZAGROS_HISTORY_URL` in `src/config/network.ts` (no CSP change: same origin).

## Short address: cuzdan.pex.network
`deploy/nginx-cuzdan.conf` is the reference copy of the host's `/etc/nginx/sites-available/cuzdan.conf`
(enabled by a symlink in `sites-enabled`). It only redirects; it never serves the site, because browser storage
is per origin and a copy of the site would hold a separate wallet. DNS: an A record `cuzdan` in the pex.network
zone pointing at the explorer host. Certificate: `certbot certonly --webroot -w /var/www/acme -d cuzdan.pex.network`
(the port-80 block serves the challenge); renewal runs from certbot's timer. Installed and live since 2026-10-16,
redirecting to the site root until the i-Wallet ships.

## i-Wallet launch checklist (owner; together, in this order)
1. **Explorer vhost CSP, in the same moment as the deploy.** The host's `connect-src` gains the three mainnet
   origins, copied from `deploy/nginx-explorer.conf`:
   `wss://rpc.pezkuwichain.io wss://asset-hub-rpc.pezkuwichain.io wss://people-rpc.pezkuwichain.io`.
   Without them the wallet cannot read balances or sign. Then `nginx -t && systemctl reload nginx`.
2. Merge to `main` (the workflow deploys). Check `https://explorer.pezkuwichain.io/i-wallet` opens the landing and
   the browser console shows no Content Security Policy errors other than one expected Safari message:
   `Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src
   directive` (directive `style-src-attr`, on a `<select>`). That is WebKit's own built-in styling of `<select>`
   (the language picker, the citizenship region), not site code; nothing looks different. Do not add
   `'unsafe-inline'` for it. Any other CSP message stops the launch. Chrome shows none at all.
3. Point the short address at the wallet: on the host, change the 443 block of `cuzdan.conf` to
   `return 301 https://explorer.pezkuwichain.io/i-wallet$is_args$args;` (as in `deploy/nginx-cuzdan.conf`), then
   `nginx -t && systemctl reload nginx`. The port-80 block already keeps the query (`$request_uri`).
4. Check that both hops keep the query string (the citizenship referrer travels in `?ref=`):
   - `curl -sI "http://cuzdan.pex.network/?ref=X"` answers `301` with `location: https://cuzdan.pex.network/?ref=X`;
   - `curl -sI "https://cuzdan.pex.network/?ref=X"` answers `301` with
     `location: https://explorer.pezkuwichain.io/i-wallet?ref=X`.
   The wallet keeps that referrer for the session, so it is still in the citizenship form after create / unlock.
5. **iPhone gate (spec §10), before any announcement.** On a real iPhone, in Safari, from `cuzdan.pex.network`:
   1. Create a wallet (write the words, pass the quiz, set the password).
   2. Send a small amount of HEZ to it, then send a small amount out of it; check the result screen and the balance.
   3. Apply for citizenship, including the "Move HEZ to the citizenship chain" step (the teleport) when People is
      empty; the apply must enable by itself once the HEZ lands.
   4. Close Safari completely, reopen `cuzdan.pex.network`: the wallet is there and locked; the password opens it.
   5. Face ID on: enable it in Settings (password, then the separate "Enable Face ID" tap), lock, unlock with Face ID,
      sign one action with Face ID. Then Face ID off in Settings, and check that the password still works.
      Face ID enrolment and unlock can only be proven on a real iPhone. If an enrolment prompt is refused or cancelled,
      iOS may keep an unusable "i-Wallet" passkey in iCloud Keychain; the web cannot remove it (Settings, Passwords
      can). Note it if it happens.
   6. Leave Safari in the background for more than 60 seconds and come back: the wallet must be locked.
   7. Add the page to the Home Screen and open it from there. Write down what it shows: the same wallet (locked), or
      no wallet (iOS can give a Home Screen app its own storage; then the wallet is opened there with the 12 words).
      The wallet's Home Screen advice depends on this answer.
   8. Look at the language picker and the citizenship region list: they open and read correctly (see step 2).
6. Rollback: if any step fails, change the 443 block of `cuzdan.conf` back to
   `return 301 https://explorer.pezkuwichain.io/;` and reload nginx; then revert the i-Wallet merge on `main`.

## i-Wallet referral list: when to move it to the indexer
The i-Wallet "Wallets you referred" list (`src/iwallet/citizen.ts` `myReferrals`) scans `referral.referrals` and `identityKyc.applications` on the public People RPC on every page view of an Approved citizen (4 + 97 entries in about 0.3 s on 2026-10-17). Move it to the People indexer (SubQuery, keyed by referrer) when `referral.referrals` passes 5,000 entries or the scan takes over 2 s on a phone, whichever comes first.

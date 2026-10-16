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
   the browser console shows no Content Security Policy errors.
3. Point the short address at the wallet: on the host, change the 443 block of `cuzdan.conf` to
   `return 301 https://explorer.pezkuwichain.io/i-wallet$is_args$args;` (as in `deploy/nginx-cuzdan.conf`), then
   `nginx -t && systemctl reload nginx`.
4. Check: `curl -sI "https://cuzdan.pex.network/?ref=X"` answers `301` with
   `location: https://explorer.pezkuwichain.io/i-wallet?ref=X`.
5. On an iPhone, open `cuzdan.pex.network` in Safari and create a wallet (no funds needed).

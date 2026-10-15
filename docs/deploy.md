# Deploy

`.github/workflows/deploy.yml` runs on push to `main` (and manually). It runs the CI gates, builds, uploads `dist/` over rsync/SSH, then checks https://explorer.pezkuwichain.io/ serves the new hashed entry script and sends a Content-Security-Policy header.

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

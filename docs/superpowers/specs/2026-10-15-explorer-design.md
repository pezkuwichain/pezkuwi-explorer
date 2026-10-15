# Pezkuwi Explorer — design

Status: approved in conversation 2026-10-15, written spec awaiting review.

## 1. Purpose

`apps.pezkuwichain.io` serves professional users: every pallet, every call, every
option, behind menus and modal dialogs. The explorer at `explorer.pezkuwichain.io`
serves the opposite audience — a citizen who has never used a blockchain and does not
know what a block, an extrinsic or a hash is.

The design rule is "tap and use", the way a phone works: one question per screen, a big
answer, large buttons, no technical words anywhere in the interface.

**Success:** a first-time user can, without help, open their account, see their
balances and recent activity, find out whether a payment arrived, and see their
citizenship status — on a phone, in Kurmancî.

## 2. Scope

**Phase 1 (this spec): read only.** No signing, no transactions, no keys.

**Phase 2 (later, separate spec):** basic actions — send, stake, vote — replacing the
"do this in apps" links that Phase 1 shows.

Out of scope for both phases: anything `apps` does for professionals (raw extrinsics,
chain state queries, developer tools, sudo).

## 3. Screens

Every screen: back button top-left, everything reachable with one thumb, no
technical vocabulary ("block", "extrinsic", "hash", "pallet", "era" never appear).

### 3.1 Home
- Logo and language picker at the top (default Kurmancî).
- A 2×2 grid of large square buttons, each an icon plus one word:
  **My account** · **Did my payment arrive?** · **Citizenship** · **Network**.
- A small status light at the bottom: green "The network is working".

### 3.2 My account
- First visit: three large buttons — **Open with my wallet** · **Scan QR** ·
  **Paste address**.
- Once open: total balance on top, one card per asset (HEZ, PEZ, USDT, …), then a
  plain-language timeline ("You sent 5 HEZ to Ali · 2 hours ago ✅").
- Tapping a timeline entry opens a detail page: who, how much, when, fee, a large
  success/failure mark.
- The device remembers the account; next visit opens it directly. A
  **Forget on this device** button clears it.

### 3.3 Did my payment arrive?
- One search box: "Paste the transaction code or an address", plus QR scan.
- Full-screen answer: ✅ **Arrived** / ⏳ **On its way** / ❌ **Did not arrive**, with
  one explanatory sentence (e.g. "Not sent because the fee was not enough — your money
  is still in your account").

### 3.4 Citizenship
- Uses the open account, or offers the same three entry buttons.
- Application progress as a step bar: Applied → Approved → Citizen.
- Tikis (roles) shown as badges; trust score as a single number.

### 3.5 Network
- One large light: "The network is working".
- Three cards: **Votes** (active proposals with plain titles) · **Treasury** (total) ·
  **Validators** (how many are active).
- Phase 1 shows "To vote, use apps.pezkuwichain.io" on the Votes card.

### 3.6 Footer
- A small link "For experts: apps.pezkuwichain.io" on every screen.

## 4. Architecture

**A static site.** React + TypeScript + Vite, built to static files and served by nginx.
No server code, no database, no secrets on the host. Packaged as a PWA so it can be added
to a phone's home screen.

### 4.1 Data sources
All reads happen in the browser. Every endpoint lives in one config file
(`src/config/network.ts`); the mainnet genesis reset changes only that file.

| screen | source |
|---|---|
| balances, assets | relay + Asset Hub RPC via `@pezkuwi/api` |
| history, "did it arrive" | SubQuery GraphQL (`subquery.pezkuwichain.io`, `/assethub`) |
| citizenship, tikis, trust | People RPC: pallets `identity-kyc` (51), `tiki` (61), `trust` (81) |
| votes, treasury, validators | relay, Asset Hub and People RPC (`welati` (75) for elections) |

Storage item names and their decoding are pinned in the implementation plan against
the live metadata, not against this document.

Pezkuwi tooling only: `@pezkuwi/*` packages, never `@polkadot/*`.

### 4.2 Honest empty and failure states
- No endless spinners. Every request has a timeout and a plain message.
- Where data does not exist yet, say so ("This section is being prepared"), e.g. relay
  history until the indexer has an archive node behind it.
- One failing source greys out its own card only; the rest of the site keeps working.

### 4.3 Opening an account (address only, never a signature)
- **Desktop:** Pezkuwi browser extension via `@pezkuwi/extension-dapp`, requesting the
  account list only.
- **Phone:** Pezkuwi Wallet via WalletConnect, requesting accounts only — no signing
  methods in the session namespace.
- **QR:** the phone camera, decoded entirely in the browser.
- **Paste:** address validated (SS58 checksum) before anything is queried.
- **Remembering:** the address is stored in this browser only (`localStorage`, wrapped
  so a blocked store degrades to "ask again"). Nothing is sent to any server of ours.

## 5. Language

Six languages; Kurmancî is the default. i18n is set up in the first commit; no
user-facing string is ever written into a component. Soranî, Persian and Arabic render
right-to-left and the whole layout mirrors.

Kurdish text is never invented: strings without a native-speaker source are marked
for review rather than guessed.

## 6. Visual identity

Matches `pezkuwichain.io`:

- **Colours:** green `#1ec76e` / `#14a05a` as the primary (buttons, "Arrived"), gold
  `#eeae1f` as the accent, red only for "Did not arrive", dark surface `#0d1117`.
- **Theme:** follows the phone's setting; light is the default.
- **Type:** Inter, and Noto Sans Arabic for Arabic script, self-hosted (no third-party
  font requests). Body at least 17 px, buttons 20 px or larger.
- **Touch targets:** at least 56 px tall.
- **Icons:** large, single-colour, understandable without words.
- **Accessibility:** WCAG 2.1 AA contrast, screen-reader labels, respects
  reduced-motion.

## 7. Delivery

- Repository `pezkuwichain/pezkuwi-explorer`, public, Apache-2.0.
- CI on every pull request: typecheck, lint, unit tests, build, bundle-size check.
- Deploy: GitHub Actions builds and copies the static files to the host with a deploy
  key scoped to that host and that directory only.
- Security headers on the host: CSP restricted to the configured RPC, SubQuery and
  WalletConnect origins; HSTS; `frame-ancestors 'none'`.

## 8. Testing

- Unit tests for every formatter that turns chain data into a sentence (amounts,
  decimals, plain-language timeline entries, status mapping).
- Component tests for each screen's loading, empty, failure and success states.
- An end-to-end smoke test against the live endpoints in CI: home loads, a known
  address shows a balance, the network light resolves.
- Manual check on a real phone (iOS Safari and Android Chrome) before go-live.

## 9. Open items carried into the plan
- The trust score's storage item and the citizenship application states are read from
  live metadata and pinned there.
- WalletConnect project id: reuse the one already used by the Pezkuwi web app, or
  register a new one — decided in the plan.

### Gates before enabling history

The history screens ship with no indexer configured (`history.*` is null in
`src/config/network.ts`), so they show "being prepared". Before any `history.*` is set to
a real indexer, every item below must be fixed and tested. **All eight are closed** (each
with a test that failed before its fix); the endpoint is prepared but not enabled:
`ZAGROS_HISTORY_URL` (`https://explorer.pezkuwichain.io/history/assethub`, same origin, served
by `location = /history/assethub` in `deploy/nginx-explorer.conf`) is exported from
`src/config/network.ts`, and `history.assetHub` stays null until the indexer has caught up
(bd6d51f). `src/screens/HistoryEnabled.test.tsx` runs both screens end to end with it set.

1. **Address-lookup verdict**: a lookup by address must show the amount, the time and the counterparty of the payment it found (or a list of recent payments), not a bare ✅ — today it reports only the newest transfer as "Arrived". — **Closed** (8882abd): an address lookup lists up to five recent transfers (direction relative to the address, amount, counterparty, time, ✅/❌) with no single verdict; a code lookup keeps its verdict and shows amount, time and counterparty.
2. **Batch extrinsics**: a code that covers several transfers (a batch) must report every transfer, not only the first one. — **Closed** (8882abd): every transfer of a code is listed, one per event, from the sender's side; mixed outcomes read "only part of it arrived".
3. **null === null is 'sent'**: in toActivity, an unparseable `from` and an unparseable account both normalise to null and compare equal, so the row reads "sent"; compare only when both are valid addresses. — **Closed** (8882abd): addresses are compared only when both are readable; otherwise the row is neither sent nor received.
4. **NaN event index**: eventIdx returns NaN for an id without a numeric second segment and the sort comparator then misorders; treat a non-numeric index as last explicitly. — **Closed** (8882abd): total order — numeric index, non-numeric last, then the -from node, then the id.
5. **Activity.code validation**: the indexer's extrinsicHash is shown as the transaction code; accept it only when it is 0x followed by 64 hex digits. — **Closed** (8882abd in the data layer, 25b0a96 for router state in the activity detail, which now shows a valid code).
6. **Empty list markup**: the activity card renders an empty list element next to the "no activity yet" sentence; render one or the other. — **Closed** (25b0a96).
7. **`now` frozen at mount**: relative times on the account screen are computed against the time the screen opened; refresh it so "2 minutes ago" does not stay true for an hour. — **Closed** (8882abd `useNow`, 25b0a96 on the account screen): refreshed on each history load and every 60 s while mounted.
8. **History test isolation**: tests that set NETWORK.history.* must restore it, so no test depends on another's indexer setting. — **Closed** (8882abd): beforeEach sets the indexer, afterEach restores the shipped setting.

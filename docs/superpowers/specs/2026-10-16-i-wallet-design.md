# i-Wallet — design

Status: mockup approved by Serok 2026-10-16 ("onayliyorum. yap"); written spec awaiting review.
Mockup: the "i-Wallet taslağı" canvas (7 boards). Decisions log outside the repo.

## 1. Purpose

The Pezkuwi Wallet is on Android only until its App Store release. i-Wallet is a
temporary hot wallet inside the explorer for iPhone users. It covers two jobs:

- small transfers (e.g. "send my brother 100 HEZ");
- citizenship work.

It is deliberately not a vault. A warning card says so on every visit and sends
high-value users to the Android app.

**Success:** an iPhone user who types `cuzdan.pex.network` can do all of this in Safari,
without help:

- create a wallet, with a verified 12-word backup;
- see HEZ / PEZ / USDT;
- send HEZ to another address;
- apply for citizenship;

and the wallet still opens after they close and reopen the site.

## 2. Scope

**In:**
- the 5th tab and its warning card;
- create, import (12 or 24 words), unlock, lock, show backup, export JSON, delete from device;
- optional Face ID;
- balances;
- receive (QR + copy);
- send HEZ / PEZ / USDT, with a large-amount warning above **1000 HEZ**;
- citizenship: apply, approve a referral, confirm, cancel;
- moving HEZ from Asset Hub to the People chain when citizenship needs it.

**Out:**
- staking, voting, swaps;
- multiple wallets per device;
- hardware wallets;
- WalletConnect *serving* (i-Wallet does not act as a wallet for other dapps).

The four existing tabs are unchanged and stay on Zagros.

## 3. Network

i-Wallet runs on **mainnet** (Serok, 2026-10-16), the current pre-genesis chain. The rest of
the explorer stays on Zagros, so i-Wallet has its own config file,
`src/config/iwallet-network.ts`. It is the only file that changes at the genesis reset.

Values measured live 2026-10-16:

| chain | RPC | genesis | ED (TYR) |
|---|---|---|---|
| relay | `wss://rpc.pezkuwichain.io` | `0x1aa94987791a5544e9667ec249d2cef1b8fdd6083c85b93fc37892d54a1156ca` | 33333333 |
| Asset Hub | `wss://asset-hub-rpc.pezkuwichain.io` | `0xe7c15092dcbe3f320260ddbbc685bfceed9125a3b3d8436db2766201dec3b949` | 3333333 |
| People (para 1004) | `wss://people-rpc.pezkuwichain.io` | `0x69a8d025ab7b63363935d7d9397e0f652826c94271c1bc55c4fdfe72cccf1cfa` | 3333333 |

- **Format and decimals:** SS58 42; HEZ has 12 decimals.
- **Assets:**
  - PEZ is asset 1, 12 decimals, minBalance 1.
  - USDT is asset 1000, 6 decimals, minBalance 10000.
- **Where HEZ lives:** issuance is 207.4M on Asset Hub, against 1.4M on the relay and 0.1M on People. So **HEZ transfers go on Asset Hub**, like the P2P deposit in pwap.
- **API options:** every `ApiPromise` that signs passes pwap's custom signed extensions:
  `AuthorizeCall` and `StorageWeightReclaim`, each with empty `extrinsic` and `payload`.
- **CSP:** the CSP `connect-src` gains the three mainnet `wss://` origins in the same commit.

**At the genesis reset:**
- The keystore survives: the same words give the same address.
- On-chain balances and citizenship records are lost unless genesis carries them. That is a chain-session decision; i-Wallet only changes its config file.

## 4. Key custody

- **Generation:**
  - `mnemonicGenerate(12)` from `@pezkuwi/util-crypto`.
  - sr25519 pair via `@pezkuwi/keyring` 14.0.26, matching the util versions already in the explorer.
- **Backup is mandatory:**
  - The 12 words are shown once with a red "write it on paper, no screenshot" warning and a "I wrote them down" checkbox.
  - The user then picks words 3, 7 and 11 from 3 options each.
  - The wallet is not saved until this passes.
  - The words are never copied to the clipboard by the app.
- **Storage:**
  - The words themselves are also stored, encrypted with the same password (`jsonEncrypt` from `@pezkuwi/util-crypto`, scrypt + xsalsa20-poly1305). A keystore holds the seed, not the words, and "show backup words" must work later, e.g. to move to the App Store app.
  - `pair.toJson(password)` (scrypt + xsalsa20-poly1305, the polkadot-js JSON format the Pezkuwi Wallet can import).
  - Stored in IndexedDB under the explorer origin, with `navigator.storage.persist()` requested.
  - Nothing ever leaves the device.
- **Password:**
  - At least 8 characters, with a strength meter.
  - It decrypts the keystore; forgetting it means re-importing from the words.
- **Unlocked state:**
  - The decoded pair lives only in memory.
  - It locks after 5 minutes idle, when the page is hidden for 60 s, and on reload.
- **Face ID (optional):**
  - Uses a WebAuthn platform credential with the **PRF extension**. Its output (32 bytes) is an AES-GCM key that encrypts the password; the ciphertext is stored beside the keystore.
  - Unlock = Face ID → PRF → password → keystore.
  - Where PRF is unsupported the switch is hidden, never shown broken.
- **Safari storage eviction:**
  - Safari can clear site data of a site not added to the Home Screen after 7 days without a visit.
  - The wallet screen therefore shows a one-line "Add to Home Screen" hint (the explorer is already a PWA), and the backup step says why the words matter.
- **Import:** 12 or 24 words, checked with `mnemonicValidate`, then a password (and optional Face ID). No backup quiz.
- **Export:**
  - "Show backup words" requires the password.
  - "Export JSON" downloads the encrypted keystore file for moving to the App Store app later.
- **Delete from device:** a confirm dialog that states the words are the only way back.

## 5. Screens

As in the approved mockup.

- **i-Wallet tab, no wallet:**
  - warning card (Serok's text), "Pezkuwi ana ağ" chip;
  - "i-Wallet edin" and "Zaten cüzdanım var · 12 kelimeyle aç".
- **Tab bar:**
  - 5 equal columns.
  - The new tab's icon is phone + key ("Hesap" already uses the wallet icon).
  - Route `/i-wallet`.
- **Create:** 3 steps (words → verify → password + Face ID).
- **Locked:** password field, or a Face ID button.
- **Wallet home:**
  - a permanent thin hot-wallet strip;
  - address + copy;
  - HEZ total (Asset Hub, with relay/People parts listed when non-zero);
  - Send / Receive / Citizenship;
  - PEZ and USDT rows;
  - a settings menu: show backup, export JSON, lock, delete.
- **Send:**
  - recipient (paste or QR scan with the existing `jsqr` decoder), token picker, amount, Max;
  - live fee from `paymentInfo`.
  - **Above 1000 HEZ:** an orange warning plus an "I understand, send anyway" checkbox gate the confirm button. The threshold applies to HEZ amounts.
  - Confirm asks for the password (or Face ID) again.
  - Result screen: in block → finalized, with a link to the explorer's payment-status screen.
- **Receive:** QR of the address (existing `qrcode-generator`), copy button.
- **Citizenship:** see §6.

## 6. Citizenship (People chain, pallet `identityKyc`)

Ported from pwap `shared/lib/citizenship-workflow.ts` and `NewCitizenApplication.tsx`.

- **Status** is read from `identityKyc.applications` / `kycStatuses` and `tiki.userTikis`:
  NotStarted, PendingReferral, ReferrerApproved, Approved, Revoked.
- **Apply:**
  - The form has the same fields as pwap: full name, father, grandfather, mother, tribe, marital status, children, region, email, profession, referrer.
  - `identityHash = blake2AsHex(JSON.stringify({fullName,fatherName,grandfatherName,motherName,tribe,region,email,profession,walletAddress}), 256)`, key order exactly as pwap, so both apps produce the same hash.
  - Personal data stays in this browser only.
  - Then `identityKyc.applyForCitizenship(identityHash, referrer)`. The referrer comes from `?ref=` or the field and must be a valid SS58 address; empty means `None`.
  - Deposit: `kycApplicationDeposit` = 1 HEZ, live.
- **Approve a referral** (for citizens who invited someone): list pending applications naming this account, then `approveReferral(applicant)`.
- **Confirm:** when status is ReferrerApproved, `confirmCitizenship()`.
- **Cancel:** `cancelApplication()` returns the deposit.
- **Funding People:**
  - Applying needs the deposit + fee on People, where users hold almost nothing.
  - If People free balance < deposit + fee + ED, the screen offers "Move HEZ to the citizenship chain".
  - That is `pezkuwiXcm.limitedTeleportAssets` from Asset Hub to `{ parents: 1, interior: X1(Teyrchain 1004) }`, beneficiary = own account, of `deposit + 0.5 HEZ`.
  - The exact XCM shape is pinned against live metadata with a dry run before shipping.
- **Errors:** port pwap `shared/lib/error-handler.ts` (`identityKyc.*` / `tiki.*` friendly text). Non-module errors fall back to a generic message.

## 7. Language

Six languages; Kurmancî is the default.

- Strings are ported from pwap's `transfer.*` / `newCitizen.*` where they exist.
- New Kurmancî text is checked against the Ferheng and listed in `docs/i18n-review.md` for a native reading.
- Kurdish is never invented.

## 8. Security

- No new third-party script or origin, except the three RPC origins in `connect-src`.
- No analytics.
- The keystore, words, password and personal data never leave the browser.
- Sign-only-what-you-see: every confirm screen shows the recipient, amount, fee and chain.
- No `eval`-style code; WASM is already allowed (`wasm-unsafe-eval`) for crypto.

## 9. Short address

`cuzdan.pex.network` (Serok, 2026-10-16) issues a 301 redirect to
`https://explorer.pezkuwichain.io/i-wallet`.

- It is a redirect, not a twin: browser storage is per origin, and a twin would hold a separate wallet.
- Needs a DNS record + certificate + an nginx server block. It is set up at launch.

## 10. Testing

- **Unit:**
  - keystore round-trip and wrong-password rejection;
  - mnemonic quiz;
  - amount parsing (decimals, truncation);
  - the 1000 HEZ gate;
  - Max = free − fee − ED;
  - `identityHash` equal to pwap's for a fixed vector;
  - XCM destination/beneficiary encoding;
  - error mapping.
- **Component:** each screen's locked, empty, error and success states. The confirm button stays disabled until the gates pass.
- **Live (no submission):**
  - build every extrinsic against mainnet metadata;
  - `paymentInfo` succeeds;
  - the teleport dry-run succeeds.
- **Phone:**
  - Serok sends a small amount and applies for citizenship from an iPhone before announcing.
  - Then reopen after closing Safari, and check Face ID on/off.

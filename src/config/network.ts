// The two networks the explorer can read, and the one it reads on this page load. i-Wallet never reads this
// choice: it imports its own mainnet config (src/config/iwallet-network.ts) and stays on mainnet.
import { storage } from '../lib/storage';
import { IWALLET_NETWORK } from './iwallet-network';

export type ChainKey = 'relay' | 'assetHub' | 'people';

export type NetworkConfig = {
  name: string;
  ss58: number;
  native: { symbol: string; decimals: number };
  chains: Record<ChainKey, { rpc: readonly string[]; genesis: `0x${string}` }>;
  // standard: the token-standard label the Pezkuwi Wallet appends to the network name (ChainExt.kt
  // assetStandardLabelOrNull), so a symbol that many ecosystems issue says which issuance it is.
  assets: readonly { id: number; symbol: string; decimals: number; standard?: string }[];
  // null = no indexer for this chain yet; history screens show "being prepared".
  history: { assetHub: string | null; relay: string | null };
  walletConnectProjectId: string;
};

export type NetworkId = 'mainnet' | 'zagros';
// The storage key (src/lib/storage.ts) that remembers the choice in this browser.
export const NETWORK_KEY = 'network';

// The Asset Hub history indexer for Zagros, served by the explorer's own nginx (deploy/nginx-explorer.conf,
// `location = /history/assethub`: POST only, rate-limited, proxied to the indexer's GraphQL on the host).
// Same origin as the site, so the CSP's connect-src 'self' already allows it. Enabled below: the
// indexer caught up with the chain on 2026-10-15 (last processed = target = 197855).
export const ZAGROS_HISTORY_URL = 'https://explorer.pezkuwichain.io/history/assethub';
// The mainnet Asset Hub indexer (the one the Pezkuwi Wallet reads). Measured 2026-10-17: _metadata.chain
// "Pezkuwichain Asset Hub", genesisHash = MAINNET.chains.assetHub.genesis, last processed = target = 2794057;
// its HistoryElement type has the same fields as the Zagros indexer's, and the address, extrinsicHash and
// _metadata queries of src/data/history.ts answer unchanged. connect-src lists its origin.
export const MAINNET_HISTORY_URL = 'https://subquery.pezkuwichain.io/assethub';

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '';

export const ZAGROS: NetworkConfig = {
  name: 'Zagros',
  ss58: 42,
  native: { symbol: 'HEZ', decimals: 12 },
  chains: {
    relay: { rpc: ['wss://zagros-rpc.pezkuwichain.io'], genesis: '0x1b0b4727bbb5e44ed587d1056b4ad537ffb330034509a58866a088d77e792cd5' },
    assetHub: { rpc: ['wss://zagros-asset-hub-rpc.pezkuwichain.io'], genesis: '0x063f739077881df9f291548de301b2e11d6a45cc545c24e7bf18d8a40f0ce182' },
    people: { rpc: ['wss://zagros-people-rpc.pezkuwichain.io'], genesis: '0xc72b38f36affaeb2661018b201c2be02e8c09fc699640525d39200a10fd77878' },
  },
  // The Pezkuwi Wallet's list (pezkuwi-wallet-utils chains.json, Pezkuwi Asset Hub): HEZ native, PEZ, and
  // USDT (asset 1000, shown as USDT, not wUSDT). Nothing else is shown.
  assets: [
    { id: 1, symbol: 'PEZ', decimals: 12 },
    { id: 1000, symbol: 'USDT', decimals: 6, standard: 'PEZ-20' },
  ],
  // history.assetHub is on (the indexer caught up 2026-10-15); relay stays null: there is no relay indexer. Every gate in docs/superpowers/specs/2026-10-15-explorer-design.md §9 is closed and tested:
  //   1. Address-lookup verdict: an address lookup lists up to five recent transfers (direction, amount, counterparty, time, ✅/❌; a failed row reads "Failed", never "sent"/"received"), no single verdict; a single-transfer code shows amount, time and counterparty.
  //   2. Batch extrinsics: a code lists every transfer (up to 200 nodes); more than one transfer gets no single "Arrived", and a full page says there are more and gives no verdict.
  //   3. null === null is 'sent': toActivity compares addresses only when both are valid.
  //   4. NaN event index: a non-numeric event index sorts last, deterministically.
  //   5. Activity.code validation: kept only when it is 0x followed by 64 hex digits, otherwise null.
  //   6. Empty list markup: the activity card renders the empty sentence or a list, never both.
  //   7. `now` frozen at mount: relative times refresh on each history load and every minute.
  //   8. History test isolation: tests that set NETWORK.history.* restore it.
  // src/screens/HistoryEnabled.test.tsx runs the screens end to end with assetHub = ZAGROS_HISTORY_URL.
  history: { assetHub: ZAGROS_HISTORY_URL, relay: null },
  walletConnectProjectId,
};

// Mainnet: the chains, ss58, native token and assets are the i-Wallet's (one place for the mainnet genesis
// hashes and endpoints); the history indexer and the WalletConnect project id are the explorer's own.
export const MAINNET: NetworkConfig = {
  name: IWALLET_NETWORK.name,
  ss58: IWALLET_NETWORK.ss58,
  native: IWALLET_NETWORK.native,
  chains: IWALLET_NETWORK.chains,
  assets: IWALLET_NETWORK.assets,
  history: { assetHub: MAINNET_HISTORY_URL, relay: null },
  walletConnectProjectId,
};

export const NETWORKS: Record<NetworkId, NetworkConfig> = { mainnet: MAINNET, zagros: ZAGROS };

// A first visit, or anything stored that is not a known network, reads mainnet.
export const resolveNetworkId = (stored: string | null): NetworkId => (stored === 'zagros' ? 'zagros' : 'mainnet');

// Resolved once, when the page loads: every connection, query and wallet session of this page belongs to it.
export const NETWORK_ID: NetworkId = resolveNetworkId(storage.get(NETWORK_KEY));
export const NETWORK: NetworkConfig = NETWORKS[NETWORK_ID];

// Remembers the choice and reloads the page. A reload is the simplest way to drop everything that belongs to the
// network being left: the cached ApiPromise connections (src/chain/connections.ts), the WalletConnect client and
// its session, and every loaded query; the next page load resolves NETWORK again. false (and no reload) when this
// browser would not keep the choice, because the reload would come back on the same network.
export function switchNetwork(to: NetworkId, reload: () => void = () => window.location.reload()): boolean {
  if (!storage.set(NETWORK_KEY, to)) return false;
  reload();
  return true;
}

export const caip2For = (network: NetworkConfig, chain: ChainKey) => `polkadot:${network.chains[chain].genesis.slice(2, 34)}`;
export const caip2 = (chain: ChainKey) => caip2For(NETWORK, chain);

// The only file that changes when the explorer moves from Zagros to mainnet.
export type ChainKey = 'relay' | 'assetHub' | 'people';

export type NetworkConfig = {
  name: string;
  ss58: number;
  native: { symbol: string; decimals: number };
  chains: Record<ChainKey, { rpc: readonly string[]; genesis: `0x${string}` }>;
  assets: readonly { id: number; symbol: string; decimals: number }[];
  // null = no indexer for this chain yet; history screens show "being prepared".
  history: { assetHub: string | null; relay: string | null };
  walletConnectProjectId: string;
};

// The Asset Hub history indexer for Zagros, served by the explorer's own nginx (deploy/nginx-explorer.conf,
// `location = /history/assethub`: POST only, rate-limited, proxied to the indexer's GraphQL on the host).
// Same origin as the site, so the CSP's connect-src 'self' already allows it. Not enabled here: set
// history.assetHub to this value once the indexer has caught up with the chain.
export const ZAGROS_HISTORY_URL = 'https://explorer.pezkuwichain.io/history/assethub';

export const NETWORK: NetworkConfig = {
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
  // history.* stays null until the owner switches it on (assetHub -> ZAGROS_HISTORY_URL, after the indexer has
  // caught up). Every gate in docs/superpowers/specs/2026-10-15-explorer-design.md §9 is closed and tested:
  //   1. Address-lookup verdict: an address lookup lists up to five recent transfers (direction, amount, counterparty, time, ✅/❌), no single verdict; a code lookup shows amount, time and counterparty.
  //   2. Batch extrinsics: a code that covers several transfers (a batch) reports every transfer.
  //   3. null === null is 'sent': toActivity compares addresses only when both are valid.
  //   4. NaN event index: a non-numeric event index sorts last, deterministically.
  //   5. Activity.code validation: kept only when it is 0x followed by 64 hex digits, otherwise null.
  //   6. Empty list markup: the activity card renders the empty sentence or a list, never both.
  //   7. `now` frozen at mount: relative times refresh on each history load and every minute.
  //   8. History test isolation: tests that set NETWORK.history.* restore it.
  // src/screens/HistoryEnabled.test.tsx runs the screens end to end with assetHub = ZAGROS_HISTORY_URL.
  history: { assetHub: null, relay: null },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '',
};

export const caip2 = (chain: ChainKey) => `polkadot:${NETWORK.chains[chain].genesis.slice(2, 34)}`;

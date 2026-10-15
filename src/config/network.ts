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
  // Before setting history.* to a real indexer (see docs/superpowers/specs/2026-10-15-explorer-design.md §9):
  //   1. Address-lookup verdict: a lookup by address must show the amount, the time and the counterparty of the payment it found (or a list of recent payments), not a bare ✅ — today it reports only the newest transfer as "Arrived".
  //   2. Batch extrinsics: a code that covers several transfers (a batch) must report every transfer, not only the first one.
  //   3. null === null is 'sent': in toActivity, an unparseable `from` and an unparseable account both normalise to null and compare equal, so the row reads "sent"; compare only when both are valid addresses.
  //   4. NaN event index: eventIdx returns NaN for an id without a numeric second segment and the sort comparator then misorders; treat a non-numeric index as last explicitly.
  //   5. Activity.code validation: the indexer's extrinsicHash is shown as the transaction code; accept it only when it is 0x followed by 64 hex digits.
  //   6. Empty list markup: the activity card renders an empty list element next to the "no activity yet" sentence; render one or the other.
  //   7. `now` frozen at mount: relative times on the account screen are computed against the time the screen opened; refresh it so "2 minutes ago" does not stay true for an hour.
  //   8. History test isolation: tests that set NETWORK.history.* must restore it, so no test depends on another's indexer setting.
  history: { assetHub: null, relay: null },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '',
};

export const caip2 = (chain: ChainKey) => `polkadot:${NETWORK.chains[chain].genesis.slice(2, 34)}`;

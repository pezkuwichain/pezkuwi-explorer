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
  history: { assetHub: null, relay: null },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '',
};

export const caip2 = (chain: ChainKey) => `polkadot:${NETWORK.chains[chain].genesis.slice(2, 34)}`;

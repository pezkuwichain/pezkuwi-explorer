// i-Wallet runs on mainnet while the rest of the explorer stays on Zagros (src/config/network.ts).
// This is the only file that changes at the genesis reset. Values: spec §3, measured 2026-10-16.
import type { NetworkConfig } from './network';

export type IWalletNetworkConfig = NetworkConfig & { xcm: { peopleParaId: number } };

export const IWALLET_NETWORK: IWalletNetworkConfig = {
  name: 'Pezkuwi',
  ss58: 42,
  native: { symbol: 'HEZ', decimals: 12 },
  chains: {
    relay: { rpc: ['wss://rpc.pezkuwichain.io'], genesis: '0x1aa94987791a5544e9667ec249d2cef1b8fdd6083c85b93fc37892d54a1156ca' },
    assetHub: { rpc: ['wss://asset-hub-rpc.pezkuwichain.io'], genesis: '0xe7c15092dcbe3f320260ddbbc685bfceed9125a3b3d8436db2766201dec3b949' },
    people: { rpc: ['wss://people-rpc.pezkuwichain.io'], genesis: '0x69a8d025ab7b63363935d7d9397e0f652826c94271c1bc55c4fdfe72cccf1cfa' },
  },
  assets: [
    { id: 1, symbol: 'PEZ', decimals: 12 },
    { id: 1000, symbol: 'USDT', decimals: 6, standard: 'PEZ-20' },
  ],
  history: { assetHub: null, relay: null },
  walletConnectProjectId: '',
  xcm: { peopleParaId: 1004 },
};

// Existential deposits in TYR (spec §3).
export const IWALLET_ED = { relay: 33333333n, assetHub: 3333333n, people: 3333333n } as const;

// Custom signed extensions every signing ApiPromise needs (as in pwap).
export const IWALLET_SIGNED_EXTENSIONS = {
  AuthorizeCall: { extrinsic: {}, payload: {} },
  StorageWeightReclaim: { extrinsic: {}, payload: {} },
} as const;

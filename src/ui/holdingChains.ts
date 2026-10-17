import type { ChainKey } from '../config/network';

// The order in which the native total is split on the Account tab and the i-Wallet home, and the i-Wallet's
// send-network list.
export const HOLDING_CHAINS: readonly ChainKey[] = ['relay', 'assetHub', 'people'];

import { lazy, Suspense } from 'react';
import IWalletLoading from './IWalletLoading';

const IWalletTree = lazy(() => import('./IWalletTree'));

// The /i-wallet subtree, loaded on first visit; until it has arrived the i-Wallet's loading placeholder shows.
export default function LazyIWallet() {
  return <Suspense fallback={<IWalletLoading />}><IWalletTree /></Suspense>;
}

import type { ReactNode } from 'react';
import { useIWallet } from './IWalletContext';
import { IWalletIndex } from './IWalletRoutes';

// Wallet screens show data only while unlocked. In every other state the tab's own screen shows instead
// (loading, landing, or the unlock form), so a locked wallet never leaks its address or balances.
export default function RequireUnlocked({ children }: { children: (address: string) => ReactNode }) {
  const { state, address } = useIWallet();
  if (state !== 'unlocked' || !address) return <IWalletIndex />;
  return <>{children(address)}</>;
}

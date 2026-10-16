import type { ReactNode } from 'react';
import { useIWallet } from './IWalletContext';
import { IWalletIndex } from './IWalletRoutes';

// Wallet screens show data only while unlocked. In every other state the tab's own screen shows instead
// (loading, landing, or the unlock form), so a locked wallet never leaks its address or balances.
// One exception: a screen that is signing or showing a transaction result holds itself open through a lock
// (useHoldOpen). That screen holds no secret (the signing pair is locked right after signing), and dropping it would
// hide whether the money left, inviting a second send. Leaving the result releases the hold.
export default function RequireUnlocked({ children }: { children: (address: string) => ReactNode }) {
  const { state, address, holdOpen } = useIWallet();
  const show = state === 'unlocked' || (state === 'locked' && holdOpen);
  if (!show || !address) return <IWalletIndex />;
  return <>{children(address)}</>;
}

import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIWallet } from './IWalletContext';
import Landing from './screens/Landing';

// Placeholders: later tasks replace the locked and home screens.
function Placeholder({ k }: { k: string }) {
  const { t } = useTranslation();
  return <h1>{t(k)}</h1>;
}

// The index of /i-wallet switches on the wallet state; create, import, send, receive, citizen and settings
// are added as sibling children by later tasks.
export function IWalletIndex() {
  const { t } = useTranslation();
  const { state } = useIWallet();
  if (state === 'loading') return <p className="card-note" role="status">{t('state.loading')}</p>;
  if (state === 'none' || state === 'unavailable') return <Landing />;
  return <Placeholder k={state === 'locked' ? 'iwallet.locked.title' : 'iwallet.home.title'} />;
}

export default function IWalletShell() {
  return <Outlet />;
}

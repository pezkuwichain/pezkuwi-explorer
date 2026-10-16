import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import { useIWallet } from './IWalletContext';
import Landing from './screens/Landing';
import Unlock from './screens/Unlock';

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
  if (state === 'idle' || state === 'loading') {
    // Same outer layout as the screens, so nothing jumps when the state resolves.
    return (
      <div className="iw">
        <PageHeader title={t('iwallet.title')} />
        <div className="iw-body"><p className="card-note" role="status">{t('state.loading')}</p></div>
      </div>
    );
  }
  if (state === 'none' || state === 'unavailable') return <Landing />;
  if (state === 'locked') return <Unlock />;
  return <Placeholder k="iwallet.home.title" />;
}

// Every /i-wallet route loads the stored keystore; other routes never open IndexedDB.
export default function IWalletShell() {
  const { ensureLoaded } = useIWallet();
  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);
  return <Outlet />;
}

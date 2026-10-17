import { useEffect, useSyncExternalStore } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import { useIWallet } from './IWalletContext';
import { networkChanged, subscribeNetworkChanged } from './chain';
import { rememberReferrer } from './citizen';
import { useDecrypting } from './progress';
import { ProgressOverlay } from '../ui/ProgressOverlay';
import Landing from './screens/Landing';
import Unlock from './screens/Unlock';
import Home from './screens/Home';

// The index of /i-wallet switches on the wallet state; create, import, send, receive, citizen and settings
// are added as sibling children by later tasks.
export function IWalletIndex() {
  const { t } = useTranslation();
  const { state, address } = useIWallet();
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
  return address ? <Home address={address} /> : null;
}

// Every /i-wallet route loads the stored keystore; other routes never open IndexedDB.
export default function IWalletShell() {
  const { t } = useTranslation();
  const { ensureLoaded } = useIWallet();
  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);
  const [params] = useSearchParams();
  const ref = params.get('ref');
  useEffect(() => { if (ref) rememberReferrer(ref); }, [ref]);
  // A mainnet endpoint answered with another chain: the wallet refuses it (src/iwallet/chain.ts) and says why here.
  const changed = useSyncExternalStore(subscribeNetworkChanged, networkChanged);
  // Opening or saving the key takes seconds on a phone: say so over the whole screen (src/iwallet/progress.ts).
  const decrypting = useDecrypting();
  return (
    <>
      {decrypting && <ProgressOverlay message={t('iwallet.unlocking')} />}
      {changed && (
        <div className="iw"><div className="iw-body"><p className="iw-error" role="alert">{t('iwallet.error.networkChanged')}</p></div></div>
      )}
      <Outlet />
    </>
  );
}

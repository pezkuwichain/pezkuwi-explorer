import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import './iwallet.css';

// The i-Wallet's loading placeholder: while the stored wallet is read, and while the i-Wallet code itself loads.
// Same outer layout as the screens, so nothing jumps when they arrive.
export default function IWalletLoading() {
  const { t } = useTranslation();
  return (
    <div className="iw">
      <PageHeader title={t('iwallet.title')} />
      <div className="iw-body"><p className="card-note" role="status">{t('state.loading')}</p></div>
    </div>
  );
}

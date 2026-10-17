import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../ui/PageHeader';
import { Card } from '../../ui/Card';
import { HoldingsTokens, HoldingsTotal } from '../../ui/Holdings';
import { IconArrow, IconIdTab, IconReceived, IconSettings, IconWarning } from '../../ui/icons';
import { shortAddress } from '../../lib/address';
import { useAsync } from '../../hooks/useAsync';
import { loadWalletHoldings } from '../data';
import { InstallButton } from '../Install';
import { useInstallMode } from '../installMode';
import CopyAddress from '../CopyAddress';
import '../iwallet.css';

function AddressRow({ address }: { address: string }) {
  return (
    <div className="iw-addr iw-home-addr">
      <bdi dir="ltr" className="iw-addr-text" title={address}>{shortAddress(address)}</bdi>
      <CopyAddress address={address} />
    </div>
  );
}

// The unlocked wallet (spec §5): hot-wallet strip, then the Account tab's balance card on mainnet (the HEZ total and
// where it sits on Relay, Asset Hub and People, fail-closed, never partial) with the address, the three actions, and
// the Account tab's token rows (HEZ, PEZ, USDT).
export default function Home({ address }: { address: string }) {
  const { t } = useTranslation();
  const holdings = useAsync(() => loadWalletHoldings(address), [address]);
  const install = useInstallMode();

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.home.title')} />
      <div className="iw-body">
        <div className="iw-toprow">
          <span className="iw-chip"><span className="iw-chip-dot" />{t('iwallet.mainnet')}</span>
          <Link className="iw-icon-btn" to="/i-wallet/settings" aria-label={t('iwallet.home.settings')}><IconSettings size={22} /></Link>
        </div>

        <div className="iw-hot" role="note"><IconWarning size={16} />{t('iwallet.home.hot')}</div>

        <Card className="total-card" title={t('account.total')} status={holdings.status} onRetry={holdings.retry}>
          {holdings.data && <HoldingsTotal holdings={holdings.data} />}
          <AddressRow address={address} />
        </Card>
        {/* Address and actions need no balance, so they stay when the total is loading or failed (fail-closed). */}
        {holdings.status !== 'ok' && <AddressRow address={address} />}
        <div className="iw-actions">
          <Link className="iw-act iw-act-main" to="/i-wallet/send"><IconArrow size={20} />{t('iwallet.home.send')}</Link>
          <Link className="iw-act" to="/i-wallet/receive"><IconReceived size={20} />{t('iwallet.home.receive')}</Link>
          <Link className="iw-act" to="/i-wallet/citizen"><IconIdTab size={20} />{t('iwallet.home.citizen')}</Link>
        </div>

        {holdings.status === 'ok' && holdings.data && <HoldingsTokens holdings={holdings.data} />}

        {/* Browser data can be evicted; the Home Screen app keeps it. The button where the browser can help. */}
        {install !== 'standalone' && (
          <div className="iw-a2hs-row">
            <p className="iw-a2hs">{t('iwallet.home.a2hs')}</p>
            <InstallButton mode={install} />
          </div>
        )}
      </div>
    </div>
  );
}

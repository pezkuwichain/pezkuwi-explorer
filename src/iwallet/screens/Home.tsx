import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../ui/PageHeader';
import { Card } from '../../ui/Card';
import { BigAmount } from '../../ui/BigAmount';
import { ChainIcon, TokenIcon } from '../../ui/assetIcons';
import { IconArrow, IconIdTab, IconReceived, IconSettings, IconWarning } from '../../ui/icons';
import { formatNumber } from '../../lib/format';
import { shortAddress } from '../../lib/address';
import { useAsync } from '../../hooks/useAsync';
import { IWALLET_NETWORK } from '../../config/iwallet-network';
import type { ChainKey } from '../../config/network';
import { loadAssetBalances, loadHezBalance } from '../data';
import { isStandalone } from '../standalone';
import CopyAddress from '../CopyAddress';
import '../iwallet.css';

const CHAINS: ChainKey[] = ['assetHub', 'relay', 'people'];
const SUB: Record<string, string> = { PEZ: 'iwallet.home.pezSub', USDT: 'iwallet.home.usdtSub' };

// The unlocked wallet (spec §5): hot-wallet strip, address + copy, the HEZ total (fail-closed, never partial), the
// three actions, and the PEZ / USDT rows. The assets card fails on its own, separate from the HEZ total.
export default function Home({ address }: { address: string }) {
  const { t, i18n } = useTranslation();
  const hez = useAsync(() => loadHezBalance(address), [address]);
  const assets = useAsync(() => loadAssetBalances(address), [address]);
  const { decimals, symbol } = IWALLET_NETWORK.native;
  const parts = hez.data && (hez.data.perChain.relay > 0n || hez.data.perChain.people > 0n) ? hez.data.perChain : null;

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.home.title')} />
      <div className="iw-body">
        <div className="iw-toprow">
          <span className="iw-chip"><span className="iw-chip-dot" />{t('iwallet.mainnet')}</span>
          <Link className="iw-icon-btn" to="/i-wallet/settings" aria-label={t('iwallet.home.settings')}><IconSettings size={22} /></Link>
        </div>

        <div className="iw-hot" role="note"><IconWarning size={16} />{t('iwallet.home.hot')}</div>

        <Card status={hez.status} onRetry={hez.retry} className="iw-balance" label={symbol}>
          <div className="iw-addr">
            <bdi dir="ltr" className="iw-addr-text" title={address}>{shortAddress(address)}</bdi>
            <CopyAddress address={address} />
          </div>
          {hez.data && <BigAmount className="iw-total" value={hez.data.total} decimals={decimals} symbol={symbol} />}
          {parts && (
            <ul className="iw-parts" aria-label={t('iwallet.home.parts')}>
              {CHAINS.map((c) => (
                <li key={c}><ChainIcon chain={c} size={18} /><span>{t(`chain.${c}`)}</span><bdi className="num">{formatNumber(parts[c], decimals, i18n.language)}</bdi></li>
              ))}
            </ul>
          )}
          <div className="iw-actions">
            <Link className="iw-act iw-act-main" to="/i-wallet/send"><IconArrow size={20} />{t('iwallet.home.send')}</Link>
            <Link className="iw-act" to="/i-wallet/receive"><IconReceived size={20} />{t('iwallet.home.receive')}</Link>
            <Link className="iw-act" to="/i-wallet/citizen"><IconIdTab size={20} />{t('iwallet.home.citizen')}</Link>
          </div>
        </Card>

        <Card status={assets.status} onRetry={assets.retry} label={t('iwallet.home.assets')}>
          <ul className="rows">
            {assets.data?.map((a) => (
              <li key={a.id} className="row">
                <TokenIcon symbol={a.symbol} size={36} />
                <div className="row-main"><span className="row-title">{a.symbol}</span><span className="row-sub">{t(SUB[a.symbol] ?? 'iwallet.home.hezSub')}</span></div>
                <span className="row-amount"><bdi className="num">{formatNumber(a.amount, a.decimals, i18n.language)}</bdi></span>
              </li>
            ))}
          </ul>
        </Card>

        {!isStandalone() && <p className="iw-a2hs">{t('iwallet.home.a2hs')}</p>}
      </div>
    </div>
  );
}

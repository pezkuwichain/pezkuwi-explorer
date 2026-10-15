import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadBalances } from '../data/balances';
import { shortAddress } from '../lib/address';
import StatusLight from '../ui/StatusLight';
import { BigAmount } from '../ui/BigAmount';
import { TokenIcon } from '../ui/assetIcons';
import { IconActivity, IconId, IconNext, IconPaste, IconScan, IconSend, IconSignal, IconWallet } from '../ui/icons';
import './Home.css';

// Opened account: the HEZ total and what else it holds. Fail-closed like the account screen: an error, never a partial total.
function AccountHero({ address }: { address: string }) {
  const { t } = useTranslation();
  const { forget, openWalletModal } = useAccount();
  const b = useAsync(() => loadBalances(address), [address]);
  const native = b.data?.[0];
  return (
    <section className="hero" aria-busy={b.status === 'loading'}>
      <div className="hero-top">
        <h2 className="hero-label">{t('home.account')} · {t('account.total')}</h2>
        {b.data && <span className="token-stack" aria-hidden="true">{b.data.map((h) => <TokenIcon key={h.symbol} symbol={h.symbol} size={26} />)}</span>}
      </div>
      {b.status === 'ok' && native && <BigAmount className="hero-amount" value={native.amount} decimals={native.decimals} symbol={native.symbol} />}
      {b.status === 'loading' && <p className="hero-note">{t('state.loading')}</p>}
      {b.status === 'error' && <p className="hero-note">{t('state.error')} <button type="button" className="retry" onClick={b.retry}>{t('state.retry')}</button></p>}
      <div className="hero-bottom">
        <span className="hero-who">
          {/* The address opens the wallet dialog on this account; Sign out stays one tap away beside it. */}
          <button type="button" className="hero-address" onClick={openWalletModal}><bdi dir="ltr" title={address}>{shortAddress(address)}</bdi></button>
          <button type="button" className="hero-signout" onClick={forget}>{t('app.signOut')}</button>
        </span>
        <Link className="hero-cta" to="/account">{t('open.go')} <IconNext size={16} stroke={2.4} /></Link>
      </div>
    </section>
  );
}

// No account yet: the same card offers the three ways in. The wallet opens the wallet dialog here; scan and
// paste open the account screen in that mode.
function OpenHero() {
  const { t } = useTranslation();
  const { openWalletModal } = useAccount();
  return (
    <section className="hero hero-open">
      <h2 className="hero-title">{t('open.title')}</h2>
      <div className="hero-ways">
        <button type="button" className="hero-way" onClick={openWalletModal}><IconWallet size={20} />{t('open.wallet')}</button>
        <Link className="hero-way" to="/account/open?way=scan"><IconScan size={20} />{t('open.scan')}</Link>
        <Link className="hero-way" to="/account/open?way=paste"><IconPaste size={20} />{t('open.paste')}</Link>
      </div>
    </section>
  );
}

const Tile = ({ to, tone, icon, label }: { to: string; tone: string; icon: ReactNode; label: string }) => (
  <Link className={`tile tile-${tone}`} to={to}><span className="tile-icon" aria-hidden="true">{icon}</span><span className="tile-label">{label}</span></Link>
);

export default function Home() {
  const { t } = useTranslation();
  const { address } = useAccount();
  return (
    <div className="home">
      <div className="home-status"><StatusLight /></div>
      {address ? <AccountHero address={address} /> : <OpenHero />}
      <div className="tiles">
        <Tile to="/payment" tone="pay" icon={<IconSend />} label={t('home.payment')} />
        <Tile to="/citizenship" tone="cit" icon={<IconId />} label={t('home.citizenship')} />
        <Tile to="/network" tone="net" icon={<IconSignal />} label={t('home.network')} />
        <Tile to="/account" tone="act" icon={<IconActivity />} label={t('account.activity')} />
      </div>
    </div>
  );
}

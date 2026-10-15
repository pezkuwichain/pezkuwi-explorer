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
        <bdi dir="ltr" className="hero-address" title={address}>{shortAddress(address)}</bdi>
        <Link className="hero-cta" to="/account">{t('open.go')} <IconNext size={16} stroke={2.4} /></Link>
      </div>
    </section>
  );
}

// No account yet: the same card offers the three ways in; each opens the account screen in that mode.
function OpenHero() {
  const { t } = useTranslation();
  return (
    <section className="hero">
      <h2 className="hero-title">{t('open.title')}</h2>
      <div className="hero-ways">
        <Link className="hero-way" to="/account/open?way=wallet"><IconWallet size={20} />{t('open.wallet')}</Link>
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

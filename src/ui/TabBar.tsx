import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconHome, IconIdTab, IconSignalTab, IconWallet } from './icons';

const TABS = [
  { to: '/', key: 'tab.home', Icon: IconHome, end: true },
  { to: '/account', key: 'tab.account', Icon: IconWallet, end: false },
  { to: '/citizenship', key: 'home.citizenship', Icon: IconIdTab, end: false },
  { to: '/network', key: 'home.network', Icon: IconSignalTab, end: false },
] as const;

// Present on every screen; NavLink marks the current tab with aria-current="page".
export default function TabBar() {
  const { t } = useTranslation();
  return (
    <nav className="tabbar" aria-label={t('tab.label')}>
      {TABS.map(({ to, key, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="tab"><Icon /><span>{t(key)}</span></NavLink>
      ))}
    </nav>
  );
}

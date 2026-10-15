import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shortAddress } from '../lib/address';
import { formatAmount } from '../lib/format';
import LanguagePicker from './LanguagePicker';
import { IconBack } from './icons';

export const Addr = ({ value }: { value: string }) => <bdi dir="ltr" title={value}>{shortAddress(value)}</bdi>;

export function Amount({ value, decimals, symbol }: { value: bigint; decimals: number; symbol: string }) {
  const { i18n } = useTranslation();
  return <bdi>{formatAmount(value, decimals, symbol, i18n.language)}</bdi>;
}

export default function Layout() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const home = useLocation().pathname === '/';
  return (
    <div className="page">
      <header className="top">
        {home ? <img className="logo" src="/logo.png" alt={t('app.name')} height={40} /> :
          <button className="back" onClick={() => nav(-1)}><IconBack /> {t('app.back')}</button>}
        <LanguagePicker />
      </header>
      <main><Outlet /></main>
      <footer><a href="https://apps.pezkuwichain.io" rel="noopener">{t('app.experts')}</a></footer>
    </div>
  );
}

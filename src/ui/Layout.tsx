import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { shortAddress } from '../lib/address';
import { formatAmount } from '../lib/format';
import LanguagePicker from './LanguagePicker';
import { IconBack } from './icons';
import { ErrorBoundary } from './ErrorBoundary';

export const Addr = ({ value }: { value: string }) => <bdi dir="ltr" title={value}>{shortAddress(value)}</bdi>;

export function Amount({ value, decimals, symbol }: { value: bigint; decimals: number; symbol: string }) {
  const { i18n } = useTranslation();
  return <bdi>{formatAmount(value, decimals, symbol, i18n.language)}</bdi>;
}

export default function Layout() {
  const { t } = useTranslation();
  const nav = useNavigate();
  // Deep links open with no in-app history; going back must still land somewhere useful.
  const goBack = () => (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0 ? nav(-1) : nav('/'));
  const { pathname } = useLocation();
  const home = pathname === '/';
  return (
    <div className="page">
      <header className="top">
        {home ? <img className="logo" src="/logo.png" alt={t('app.name')} width={136} height={40} /> :
          <button className="back" onClick={goBack}><IconBack /> {t('app.back')}</button>}
        <LanguagePicker />
      </header>
      <main><ErrorBoundary key={pathname}><Outlet /></ErrorBoundary></main>
      <footer><a href="https://apps.pezkuwichain.io" rel="noopener"><Trans i18nKey="app.experts" components={{ domain: <bdi dir="ltr" /> }} /></a></footer>
    </div>
  );
}

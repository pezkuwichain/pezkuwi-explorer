import { Outlet, useLocation } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { shortAddress } from '../lib/address';
import { formatAmount } from '../lib/format';
import LanguagePicker from './LanguagePicker';
import TabBar from './TabBar';
import { DesktopShell } from './DesktopShell';
import { ErrorBoundary } from './ErrorBoundary';
import './layout.css';

export const Addr = ({ value }: { value: string }) => <bdi dir="ltr" title={value}>{shortAddress(value)}</bdi>;

export function Amount({ value, decimals, symbol }: { value: bigint; decimals: number; symbol: string }) {
  const { i18n } = useTranslation();
  return <bdi>{formatAmount(value, decimals, symbol, i18n.language)}</bdi>;
}

export default function Layout() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  return (
    <DesktopShell>
    <div className={`page${home ? ' page-home' : ''}`}>
      {/* Inner screens carry their own header (back button and title, see PageHeader). */}
      {home && (
        <header className="brand">
          <img className="brand-mark" src="/brand/newroz-flame.svg" alt="" width={30} height={30} />
          <span className="brand-name">Pezkuwi</span>
          <LanguagePicker />
        </header>
      )}
      <main><ErrorBoundary key={pathname}><Outlet /></ErrorBoundary></main>
      {home && <footer className="experts"><a href="https://apps.pezkuwichain.io" rel="noopener"><Trans i18nKey="app.experts" components={{ domain: <bdi dir="ltr" /> }} /></a></footer>}
      <TabBar />
    </div>
    </DesktopShell>
  );
}

import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shortAddress } from '../lib/address';
import { formatAmount } from '../lib/format';
import LanguagePicker from './LanguagePicker';
import ThemePicker from './ThemePicker';
import { NetworkChip } from './NetworkChip';
import TabBar from './TabBar';
import { DesktopShell } from './DesktopShell';
import { ErrorBoundary } from './ErrorBoundary';
import SiteFooter from './SiteFooter';
import './layout.css';

export const Addr = ({ value }: { value: string }) => <bdi dir="ltr" title={value}>{shortAddress(value)}</bdi>;

export function Amount({ value, decimals, symbol }: { value: bigint; decimals: number; symbol: string }) {
  const { i18n } = useTranslation();
  return <bdi>{formatAmount(value, decimals, symbol, i18n.language)}</bdi>;
}

export default function Layout() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  // The footer shows everywhere except under the i-Wallet's flows that hold unsaved or signing state
  // (create, import, send, citizenship): there a stray tap on a link must not lose the work.
  const walletFlow = /^\/i-wallet\/(create|import|send|citizen)(\/|$)/.test(pathname);
  return (
    <DesktopShell>
    <div className={`page${home ? ' page-home' : ''}`}>
      {/* Inner screens carry their own header (back button and title, see PageHeader). */}
      {home && (
        <header className="brand">
          <img className="brand-mark" src="/brand/newroz-flame.svg" alt="" width={30} height={30} />
          <span className="brand-name">Pezkuwi</span>
          <ThemePicker />
          <LanguagePicker />
          <NetworkChip />
        </header>
      )}
      <main><ErrorBoundary key={pathname}><Outlet /></ErrorBoundary></main>
      {!walletFlow && <SiteFooter />}
      <TabBar />
    </div>
    </DesktopShell>
  );
}

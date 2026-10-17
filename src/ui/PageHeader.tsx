import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useGoBack } from '../hooks/useGoBack';
import { IconBack } from './icons';
import LanguagePicker from './LanguagePicker';
import ThemePicker from './ThemePicker';
import { NetworkChip } from './NetworkChip';

// The header of every inner screen: back button, the screen's one h1 (one line), the theme switch and the language pill;
// under them, on explorer screens (not i-Wallet, which is always mainnet), the network this page reads.
export default function PageHeader({ title }: { title: ReactNode }) {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const iWallet = useLocation().pathname.startsWith('/i-wallet');
  return (
    <header className="page-header">
      <button type="button" className="back" onClick={goBack} aria-label={t('app.back')}><IconBack /></button>
      <h1>{title}</h1>
      <ThemePicker />
      <LanguagePicker compact />
      {!iWallet && <NetworkChip />}
    </header>
  );
}

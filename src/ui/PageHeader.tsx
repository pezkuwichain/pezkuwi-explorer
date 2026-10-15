import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGoBack } from '../hooks/useGoBack';
import { IconBack } from './icons';
import LanguagePicker from './LanguagePicker';
import ThemePicker from './ThemePicker';

// The header row of every inner screen: back button, the screen's one h1 (one line), the theme switch and the language pill.
export default function PageHeader({ title }: { title: ReactNode }) {
  const { t } = useTranslation();
  const goBack = useGoBack();
  return (
    <header className="page-header">
      <button type="button" className="back" onClick={goBack} aria-label={t('app.back')}><IconBack /></button>
      <h1>{title}</h1>
      <ThemePicker />
      <LanguagePicker compact />
    </header>
  );
}

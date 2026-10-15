import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGoBack } from '../hooks/useGoBack';
import { IconBack } from './icons';
import LanguagePicker from './LanguagePicker';

// The header row of an inner screen: back button, the screen's one h1, an optional control, and the language pill.
export default function PageHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  const { t } = useTranslation();
  const goBack = useGoBack();
  return (
    <header className="page-header">
      <button type="button" className="back" onClick={goBack} aria-label={t('app.back')}><IconBack /></button>
      <h1>{title}</h1>
      {aside}
      <LanguagePicker compact />
    </header>
  );
}

import { useTranslation } from 'react-i18next';

// Placeholder shell; the real screens replace this later.
export default function App() {
  const { t } = useTranslation();
  return <main><h1>{t('app.name')}</h1></main>;
}

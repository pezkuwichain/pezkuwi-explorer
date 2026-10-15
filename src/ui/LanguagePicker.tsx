import { useTranslation } from 'react-i18next';
import { LOCALES, setLanguage, type Locale } from '../i18n';

const NAMES: Record<Locale, string> = { kmr: 'Kurmancî', ckb: 'کوردی', tr: 'Türkçe', en: 'English', fa: 'فارسی', ar: 'العربية' };

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <select className="lang" aria-label={t('app.language')} value={i18n.language} onChange={(e) => setLanguage(e.target.value as Locale)}>
      {LOCALES.map((l) => <option key={l} value={l} lang={l}>{NAMES[l]}</option>)}
    </select>
  );
}

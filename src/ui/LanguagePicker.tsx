import { useTranslation } from 'react-i18next';
import { LOCALES, setLanguage, type Locale } from '../i18n';
import { IconGlobe } from './icons';

const NAMES: Record<Locale, string> = { kmr: 'Kurmancî', ckb: 'کوردی', tr: 'Türkçe', en: 'English', fa: 'فارسی', ar: 'العربية' };

// A pill showing the language code; the native select laid over it is what opens on tap, so the
// platform picker, keyboard and screen readers all work as before.
export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <span className="lang-pill">
      <IconGlobe size={16} />
      <span aria-hidden="true" className="lang-code">{i18n.language.toUpperCase()}</span>
      <select className="lang" aria-label={t('app.language')} value={i18n.language} onChange={(e) => setLanguage(e.target.value as Locale)}>
        {LOCALES.map((l) => <option key={l} value={l} lang={l}>{NAMES[l]}</option>)}
      </select>
    </span>
  );
}

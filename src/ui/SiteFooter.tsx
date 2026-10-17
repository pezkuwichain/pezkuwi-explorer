import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { SOCIAL } from './social';

// Under every explorer screen and the i-Wallet landing (never inside the wallet's signing screens): the experts link,
// the privacy and terms pages, and the social accounts. It sits in the page flow above the tab bar's padding.
export default function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="experts site-foot">
      <a href="https://apps.pezkuwichain.io" rel="noopener"><Trans i18nKey="app.experts" components={{ domain: <bdi dir="ltr" /> }} /></a>
      <nav className="foot-legal" aria-label={t('legal.footer')}>
        <Link to="/privacy">{t('legal.privacy')}</Link>
        <Link to="/terms">{t('legal.terms')}</Link>
      </nav>
      <ul className="foot-social" aria-label={t('legal.social')}>
        {SOCIAL.map(({ name, href, Icon }) => (
          <li key={name}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={name}><Icon size={22} /></a></li>
        ))}
      </ul>
    </footer>
  );
}

// The one line under the i-Wallet's create and import buttons, and at the end of the create flow.
export function AcceptLine() {
  return (
    <p className="accept-line">
      <Trans i18nKey="legal.accept" components={{ terms: <Link to="/terms" />, privacy: <Link to="/privacy" /> }} />
    </p>
  );
}

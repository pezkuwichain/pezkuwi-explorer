import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PLAY_STORE } from '../../account/AccountContext';
import PageHeader from '../../ui/PageHeader';
import { IconArrow, IconBars, IconIdTab, IconPhoneKey, IconWarning } from '../../ui/icons';
import { useIWallet } from '../IWalletContext';
import '../iwallet.css';

// The i-Wallet tab before a wallet exists (state 'none'), or when this browser cannot store one ('unavailable').
export default function Landing() {
  const { t } = useTranslation();
  const { state } = useIWallet();
  const unavailable = state === 'unavailable';
  return (
    <div className="iw">
      <PageHeader title={t('iwallet.title')} />
      <div className="iw-body">
        <span className="iw-chip"><span className="iw-chip-dot" />{t('iwallet.mainnet')}</span>

        <section className="iw-warning" role="note" aria-label={t('iwallet.warning.label')}>
          <IconWarning size={18} className="iw-warning-icon" />
          <div className="iw-warning-text">
            <strong>{t('iwallet.warning.title')}</strong>
            <span>{t('iwallet.warning.body1')}</span>
            <span>{t('iwallet.warning.body2')}</span>
            <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer">{t('iwallet.warning.android')}</a>
          </div>
        </section>

        {unavailable ? (
          <section className="iw-unavailable" role="alert">
            <h2>{t('iwallet.unavailable.title')}</h2>
            <p>{t('iwallet.unavailable.body')}</p>
          </section>
        ) : (
          <section className="iw-hero">
            <span className="iw-hero-icon"><IconPhoneKey size={28} /></span>
            <div className="iw-hero-text">
              <h2>{t('iwallet.create.title')}</h2>
              <p>{t('iwallet.create.body')}</p>
            </div>
            <Link className="iw-hero-primary" to="/i-wallet/create">{t('iwallet.create.cta')}</Link>
            <Link className="iw-hero-secondary" to="/i-wallet/import">{t('iwallet.import.cta')}</Link>
          </section>
        )}

        <ul className="iw-features">
          <li><IconArrow className="iw-f-pay" /><span>{t('iwallet.feature.send')}</span></li>
          <li><IconIdTab className="iw-f-cit" /><span>{t('iwallet.feature.citizen')}</span></li>
          <li><IconBars className="iw-f-net" /><span>{t('iwallet.feature.balances')}</span></li>
        </ul>
      </div>
    </div>
  );
}

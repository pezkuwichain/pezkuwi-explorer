import type { ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadCitizenship } from '../data/citizenship';
import { Card } from '../ui/Card';
import PageHeader from '../ui/PageHeader';
import { formatInteger } from '../lib/format';
import { shortAddress } from '../lib/address';
import { IconCheck, IconExternal, IconHall, IconLines, IconPerson } from '../ui/icons';
import './Citizenship.css';

const STEPS = ['applied', 'approved', 'citizen'] as const;
type Step = (typeof STEPS)[number];
const isStep = (s: string): s is Step => (STEPS as readonly string[]).includes(s);

// A few well-known roles get their own mark and colour; every other role is a person in green.
type RoleLook = { Icon: ComponentType<{ size?: number }>; tone: 'ok' | 'zer' | 'info' };
const ROLE_LOOK: Record<string, RoleLook> = {
  Welati: { Icon: IconPerson, tone: 'ok' },
  Noter: { Icon: IconHall, tone: 'zer' }, Dadger: { Icon: IconHall, tone: 'zer' }, Dozger: { Icon: IconHall, tone: 'zer' },
  Hiquqnas: { Icon: IconHall, tone: 'zer' }, Parlementer: { Icon: IconHall, tone: 'zer' }, Wezir: { Icon: IconHall, tone: 'zer' },
  Perwerdekar: { Icon: IconLines, tone: 'info' }, Mamoste: { Icon: IconLines, tone: 'info' }, Rewsenbîr: { Icon: IconLines, tone: 'info' },
};
const lookOf = (role: string): RoleLook => ROLE_LOOK[role] ?? { Icon: IconPerson, tone: 'ok' };

export default function Citizenship() {
  const { t, i18n } = useTranslation();
  const { address } = useAccount();
  // Hooks run before the redirect; the guard keeps a missing account from reaching the chain.
  const s = useAsync(() => (address ? loadCitizenship(address) : Promise.resolve(null)), [address]);
  if (!address) return <Navigate to="/account/open?next=/citizenship" replace />;
  const data = s.data;
  const stage = data?.stage;
  const at = stage && isStep(stage) ? STEPS.indexOf(stage) : -1;
  return (
    <>
      <PageHeader title={t('citizenship.title')} />
      <div className="screen citizenship">
        <Card className="citizen-card" status={s.status} onRetry={s.retry} label={t('citizenship.card')}>
          <div className="cc-top">
            <img src="/brand/newroz-flame.svg" alt="" width={34} height={34} />
            <span className="cc-name"><span className="cc-title">{t('citizenship.title')}</span><span className="cc-chain">PezkuwiChain</span></span>
            {stage === 'citizen' && <span className="pill pill-ok cc-chip"><IconCheck size={14} />{t('citizenship.approved')}</span>}
          </div>
          {stage === 'notStarted' && <p className="cc-message">{t('citizenship.notStarted')}</p>}
          {stage === 'revoked' && <p className="cc-message">{t('citizenship.revoked')}</p>}
          <div className="cc-bottom">
            <span className="cc-id">
              {data?.nftId != null && <bdi className="cc-number">№ {formatInteger(data.nftId, i18n.language)}</bdi>}
              <bdi dir="ltr" className="cc-address" title={address}>{shortAddress(address)}</bdi>
            </span>
            <span className="cc-trust">
              <span className="cc-trust-label">{t('citizenship.trust')}</span>
              <span className="cc-trust-value"><bdi>{data ? formatInteger(data.trust, i18n.language) : ''}</bdi></span>
            </span>
          </div>
        </Card>
        {at >= 0 && (
          <section className="steps-card" aria-label={t('citizenship.steps')}>
            <ol className="steps">{STEPS.map((st, i) => (
              <li key={st} className={i <= at ? 'done' : ''} aria-current={st === stage ? 'step' : undefined}>
                <span className="step-dot" aria-hidden="true">{i <= at ? <span className="tick"><IconCheck size={20} /></span> : i + 1}</span>
                {t(`citizenship.${st}`)}
                {i <= at && <span className="sr-only"> ({t('citizenship.stepDone')})</span>}
              </li>))}</ol>
          </section>
        )}
        <Card className="roles" title={t('citizenship.roles')} status={s.status}>
          {data?.roles.length
            ? <ul className="badges">{data.roles.map((r) => {
                const { Icon, tone } = lookOf(r);
                return <li key={r} className={`badge badge-${tone}`}><Icon size={18} />{t(`tiki.${r}`, { defaultValue: r })}</li>;
              })}</ul>
            : <p className="card-note">{t('citizenship.noRoles')}</p>}
        </Card>
        <a className="btn btn-quiet experts-button" href="https://apps.pezkuwichain.io" rel="noopener">{t('app.expertsShort')} <IconExternal size={16} /></a>
      </div>
    </>
  );
}

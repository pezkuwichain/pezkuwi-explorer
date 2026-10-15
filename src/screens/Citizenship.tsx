import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadCitizenship } from '../data/citizenship';
import { Card } from '../ui/Card';
import { formatInteger } from '../lib/format';

const STEPS = ['applied', 'approved', 'citizen'] as const;
type Step = (typeof STEPS)[number];
const isStep = (s: string): s is Step => (STEPS as readonly string[]).includes(s);

export default function Citizenship() {
  const { t, i18n } = useTranslation();
  const { address } = useAccount();
  // Hooks run before the redirect; the guard keeps a missing account from reaching the chain.
  const s = useAsync(() => (address ? loadCitizenship(address) : Promise.resolve(null)), [address]);
  if (!address) return <Navigate to="/account/open?next=/citizenship" replace />;
  const data = s.data;
  const stage = data?.stage;
  return (
    <>
      <h1>{t('citizenship.title')}</h1>
      <Card status={s.status} onRetry={s.retry}>
        {stage === 'notStarted' && <p>{t('citizenship.notStarted')}</p>}
        {stage === 'revoked' && <p>{t('citizenship.revoked')}</p>}
        {stage && isStep(stage) && (
          <ol className="steps">{STEPS.map((st) => (
            <li key={st} className={STEPS.indexOf(st) <= STEPS.indexOf(stage) ? 'done' : ''}
                aria-current={st === stage ? 'step' : undefined}>
              {STEPS.indexOf(st) <= STEPS.indexOf(stage) && <span className="tick" aria-hidden="true">✓ </span>}
              {t(`citizenship.${st}`)}
              {STEPS.indexOf(st) <= STEPS.indexOf(stage) && <span className="sr-only"> ({t('citizenship.stepDone')})</span>}
            </li>))}</ol>)}
      </Card>
      <Card title={t('citizenship.roles')} status={s.status}>
        {data?.roles.length
          ? <ul className="badges">{data.roles.map((r) => <li key={r}>{t(`tiki.${r}`, { defaultValue: r })}</li>)}</ul>
          : <p>{t('citizenship.noRoles')}</p>}
      </Card>
      <Card title={t('citizenship.trust')} status={s.status}>
        <p className="big-number"><bdi>{data ? formatInteger(data.trust, i18n.language) : ''}</bdi></p>
      </Card>
    </>
  );
}

import { useState, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../account/AccountContext';
import { useAsync } from '../hooks/useAsync';
import { loadCitizenship } from '../data/citizenship';
import { Card } from '../ui/Card';
import PageHeader from '../ui/PageHeader';
import { IconCheck, IconClock, IconExternal, IconHall, IconLines, IconPerson } from '../ui/icons';
import { Dialog } from '../ui/Dialog';
import { CitizenCard } from '../citizen/CitizenCard';
import { PersonalEditor } from '../citizen/PersonalEditor';
import { loadPersonal, type Personal } from '../citizen/personal';
import './Citizenship.css';

const EMPTY: Personal = { given: '', surname: '', photo: null };
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
  const { t } = useTranslation();
  const { address } = useAccount();
  // Hooks run before the redirect; the guard keeps a missing account from reaching the chain.
  const s = useAsync(() => (address ? loadCitizenship(address) : Promise.resolve(null)), [address]);
  // Photo and name live in this browser only; reloaded when the account changes.
  const [personal, setPersonal] = useState<Personal>(() => (address ? loadPersonal(address) : EMPTY));
  const [shownFor, setShownFor] = useState(address);
  const [soon, setSoon] = useState(false);
  if (shownFor !== address) { setShownFor(address); setPersonal(address ? loadPersonal(address) : EMPTY); }
  if (!address) return <Navigate to="/account/open?next=/citizenship" replace />;
  const data = s.data;
  const stage = data?.stage;
  const at = stage && isStep(stage) ? STEPS.indexOf(stage) : -1;
  return (
    <>
      <PageHeader title={t('citizenship.title')} />
      <div className="screen citizenship">
        {s.status === 'ok' && data
          ? <CitizenCard address={address} data={data} personal={personal} />
          : <Card className="citizen-card-state" status={s.status} onRetry={s.retry} label={t('citizenship.card')} />}
        <PersonalEditor address={address} value={personal} onChange={setPersonal} />
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
        {/* The directorate's own service is not built yet: the button says so instead of leading nowhere. */}
        <button type="button" className="btn btn-quiet directorate-button" onClick={() => setSoon(true)}>{t('citizenship.directorate')}</button>
        <Dialog open={soon} onClose={() => setSoon(false)} icon={<IconClock size={20} />} title={t('citizenship.soonTitle')} description={t('citizenship.soonBody')}>
          <button type="button" className="btn btn-quiet" onClick={() => setSoon(false)}>{t('dialog.close')}</button>
        </Dialog>
      </div>
    </>
  );
}

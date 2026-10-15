import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadNetwork } from '../data/network';
import { Card } from '../ui/Card';
import { Light } from '../ui/StatusLight';
import { Amount } from '../ui/Layout';
import { NETWORK } from '../config/network';

export default function Network() {
  const { t } = useTranslation();
  const s = useAsync(() => loadNetwork(), []);
  const d = s.data;
  // A card is in error when the whole load failed or when its own field is null; the others still render.
  const cardStatus = (value: unknown) => (s.status !== 'ok' ? s.status : value === null || value === undefined ? 'error' : 'ok');
  return (
    <>
      <h1>{t('network.title')}</h1>
      <Light status={s.status} live={d?.live} />
      <Card title={t('network.votes')} status={cardStatus(d?.votes)} onRetry={s.retry}>
        {d?.votes?.length ? <p><bdi>{t('network.votesActive', { count: d.votes.length })}</bdi></p> : <p>{t('network.noVotes')}</p>}
        <a href="https://apps.pezkuwichain.io/#/referenda" rel="noopener">{t('network.voteHint')}</a>
      </Card>
      <Card title={t('network.treasury')} status={cardStatus(d?.treasury)} onRetry={s.retry}>
        {d?.treasury != null && <p className="big-number"><Amount value={d.treasury} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} /></p>}
      </Card>
      <Card title={t('network.validators')} status={cardStatus(d?.validators)} onRetry={s.retry}>
        {d?.validators != null && <p><bdi>{t('network.validatorsActive', { count: d.validators })}</bdi></p>}
      </Card>
    </>
  );
}

import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadNetwork, type NetworkOverview } from '../data/network';
import { Card } from '../ui/Card';
import { liveKey } from '../ui/liveKey';
import PageHeader from '../ui/PageHeader';
import { BigAmount } from '../ui/BigAmount';
import { IconBank, IconShield } from '../ui/icons';
import { NETWORK } from '../config/network';
import { formatPercent } from '../lib/format';
import './Network.css';

type Vote = NonNullable<NetworkOverview['votes']>[number];

// Aye share of the tally in whole percent (truncated); null when nobody has voted yet.
const ayeShare = (v: Vote): number | null => {
  const total = v.ayes + v.nays;
  return total === 0n ? null : Number((v.ayes * 100n) / total);
};

function Referendum({ v }: { v: Vote }) {
  const { t, i18n } = useTranslation();
  const aye = ayeShare(v);
  return (
    <li className="referendum">
      <span className="ref-title"><bdi dir="ltr">#{v.index}</bdi></span>
      {/* The bar is drawn from the same numbers written under it; it adds no information of its own. */}
      <span className={`tally${aye === null ? ' tally-empty' : ''}`} aria-hidden="true"><span className="tally-aye" style={{ inlineSize: `${aye ?? 0}%` }} /></span>
      {aye !== null && <span className="tally-text">
        <span className="aye">{t('network.aye')} <bdi>{formatPercent(aye, i18n.language)}</bdi></span>
        <span className="nay">{t('network.nay')} <bdi>{formatPercent(100 - aye, i18n.language)}</bdi></span>
      </span>}
    </li>
  );
}

export default function Network() {
  const { t } = useTranslation();
  const s = useAsync(() => loadNetwork(), []);
  const d = s.data;
  // A card is in error when the whole load failed or when its own field is null; the others still render.
  const cardStatus = (value: unknown) => (s.status !== 'ok' ? s.status : value === null || value === undefined ? 'error' : 'ok');
  const live = liveKey(s.status, d?.live);
  return (
    <>
      <PageHeader title={t('network.title')} />
      <div className="screen network">
        <section className={`live live-${live}`} role="status">
          <span className="live-orb" aria-hidden="true"><span className="live-dot" /></span>
          <span className="live-text"><span className="live-word">{t(`status.${live}`)}</span><span className="live-name">{NETWORK.name}</span></span>
        </section>
        <div className="stats">
          <Card className="stat" title={<><span className="stat-icon stat-info" aria-hidden="true"><IconShield size={22} /></span>{t('network.validators')}</>}
            status={cardStatus(d?.validators)} onRetry={s.retry}>
            {d?.validators != null && <p className="stat-value"><bdi>{t('network.validatorsActive', { count: d.validators })}</bdi></p>}
          </Card>
          <Card className="stat" title={<><span className="stat-icon stat-zer" aria-hidden="true"><IconBank size={22} /></span>{t('network.treasury')}</>}
            status={cardStatus(d?.treasury)} onRetry={s.retry}>
            {d?.treasury != null && <p className="stat-value"><BigAmount value={d.treasury} decimals={NETWORK.native.decimals} symbol={NETWORK.native.symbol} compact /></p>}
          </Card>
        </div>
        <Card className="votes" title={t('network.votes')} status={cardStatus(d?.votes)} onRetry={s.retry}>
          {d?.votes?.length
            ? <>
                <p className="pill pill-ok votes-count"><bdi>{t('network.votesActive', { count: d.votes.length })}</bdi></p>
                <ul className="referenda">{d.votes.map((v) => <Referendum key={`${v.chain}-${v.index}`} v={v} />)}</ul>
              </>
            : <p className="card-note">{t('network.noVotes')}</p>}
          <a className="btn btn-primary vote-link" href="https://apps.pezkuwichain.io/#/referenda" rel="noopener">{t('network.voteHint')}</a>
        </Card>
      </div>
    </>
  );
}

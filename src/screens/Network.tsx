import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAsync } from '../hooks/useAsync';
import { loadNetwork, type NetworkOverview } from '../data/network';
import { Card } from '../ui/Card';
import { liveKey } from '../ui/liveKey';
import PageHeader from '../ui/PageHeader';
import { BigAmount } from '../ui/BigAmount';
import { ChainIcon } from '../ui/assetIcons';
import { IconBank, IconShield } from '../ui/icons';
import { NETWORK, NETWORK_ID, switchNetwork, type NetworkId } from '../config/network';
import { useAccount } from '../account/AccountContext';
import { disconnectWalletConnect } from '../account/connectors/walletconnect';
import { Dialog } from '../ui/Dialog';
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
      <span className="ref-title"><bdi dir="ltr">#{v.index}</bdi><span className="ref-chain"><ChainIcon chain={v.chain} size={18} />{t(`chain.${v.chain}`)}</span></span>
      {/* The bar is drawn from the same numbers written under it; it adds no information of its own. */}
      <span className={`tally${aye === null ? ' tally-empty' : ''}`} aria-hidden="true"><span className="tally-aye" style={{ inlineSize: `${aye ?? 0}%` }} /></span>
      {aye !== null && <span className="tally-text">
        <span className="aye">{t('network.aye')} <bdi>{formatPercent(aye, i18n.language)}</bdi></span>
        <span className="nay">{t('network.nay')} <bdi>{formatPercent(100 - aye, i18n.language)}</bdi></span>
      </span>}
    </li>
  );
}

const CHOICES: readonly { id: NetworkId; label: string }[] = [
  { id: 'mainnet', label: 'network.mainnet' },
  { id: 'zagros', label: 'network.testnet' },
];
// How long a sign-out may wait for the wallet relay before the page reloads anyway (the local sign-out stands).
const SIGN_OUT_WAIT_MS = 2_000;

// Mainnet or the Zagros testnet, for every explorer tab (i-Wallet stays on mainnet). Choosing the other one asks
// first, because the page reloads (src/config/network.ts switchNetwork). A wallet that is signed in is signed out
// before the reload: its session was opened for the network being left.
function NetworkSwitch() {
  const { t } = useTranslation();
  const { address, source, forget } = useAccount();
  const [pending, setPending] = useState<NetworkId | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = address !== null && (source === 'walletconnect' || source === 'extension');
  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    if (signedIn) {
      // Ending the WalletConnect session is started here so the reload can wait for it (forget() alone ends it in
      // the background); it forgets the session at once, so forget's own disconnect finds nothing left to end.
      const ended = source === 'walletconnect' ? disconnectWalletConnect().catch(() => {}) : Promise.resolve();
      forget();
      await Promise.race([ended, new Promise((r) => setTimeout(r, SIGN_OUT_WAIT_MS))]);
    }
    if (!switchNetwork(pending)) { setBusy(false); setPending(null); setFailed(true); }
  };
  return (
    <>
      <div className="net-switch" role="radiogroup" aria-label={t('network.title')}>
        {CHOICES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={c.id === NETWORK_ID}
            className={`net-option net-option-${c.id}`}
            onClick={() => { setFailed(false); if (c.id !== NETWORK_ID) setPending(c.id); }}>
            <span className="net-option-dot" aria-hidden="true" />{t(c.label)}
          </button>
        ))}
      </div>
      {failed && <p className="card-note net-switch-failed" role="alert">{t('network.switchFailed')}</p>}
      <Dialog open={pending !== null} onClose={() => { if (!busy) setPending(null); }} title={t('network.switchTitle')}
        description={<>{t('network.switchBody')}{signedIn && <> {t('network.switchSignOut')}</>}</>}>
        <div className="net-switch-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>{t('network.switchConfirm')}</button>
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setPending(null)}>{t('network.switchCancel')}</button>
        </div>
      </Dialog>
    </>
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
        <NetworkSwitch />
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

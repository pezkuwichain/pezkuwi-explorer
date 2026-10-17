import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../ui/PageHeader';
import { qrModules } from '../../citizen/qr';
import CopyAddress from '../CopyAddress';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

function ReceiveBody({ address }: { address: string }) {
  const { t } = useTranslation();
  const qr = useMemo(() => qrModules(address), [address]);
  return (
    <div className="iw">
      <PageHeader title={t('iwallet.receive.title')} />
      <div className="iw-body">
        <p className="iw-lead">{t('iwallet.receive.body')}</p>
        {/* Dark modules on a white plate in every theme: scanners need the contrast, not the page palette. */}
        <svg className="iw-qr" viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} role="img" aria-label={t('iwallet.receive.qr')} shapeRendering="crispEdges">
          <rect x="-2" y="-2" width={qr.size + 4} height={qr.size + 4} className="iw-qr-bg" />
          <path d={qr.path} className="iw-qr-fg" />
        </svg>
        <div className="iw-addr iw-addr-full">
          <bdi dir="ltr" className="iw-addr-text">{address}</bdi>
          <CopyAddress address={address} />
        </div>
        {/* One address on every Pezkuwi network, as in the Pezkuwi Wallet: HEZ can arrive on any of the three. */}
        <p className="iw-lead">{t('iwallet.receive.networks')}</p>
        <p className="iw-note">{t('iwallet.receive.warn')}</p>
      </div>
    </div>
  );
}

export default function Receive() {
  return <RequireUnlocked>{(address) => <ReceiveBody address={address} />}</RequireUnlocked>;
}

import { useTranslation } from 'react-i18next';
import { BigButton } from '../ui/BigButton';
import StatusLight from '../ui/StatusLight';
import { IconWallet, IconArrow, IconId, IconSignal } from '../ui/icons';

export default function Home() {
  const { t } = useTranslation();
  return (
    <>
      <nav className="grid-2x2">
        <BigButton to="/account" icon={<IconWallet />} label={t('home.account')} />
        <BigButton to="/payment" icon={<IconArrow />} label={t('home.payment')} />
        <BigButton to="/citizenship" icon={<IconId />} label={t('home.citizenship')} />
        <BigButton to="/network" icon={<IconSignal />} label={t('home.network')} />
      </nav>
      <StatusLight />
    </>
  );
}

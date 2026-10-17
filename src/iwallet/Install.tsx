import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { IconAddSquare, IconCheck, IconShare } from '../ui/icons';
import { prompt } from '../ui/install';
import type { InstallMode } from './installMode';
import './iwallet.css';

// iOS: the three taps in the browser's Share menu, and why a wallet made in the browser does not appear in the Home
// Screen app.
function IosSteps({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const steps = [
    { icon: <IconShare size={22} />, text: t('iwallet.install.step1') },
    { icon: <IconAddSquare size={22} />, text: t('iwallet.install.step2') },
    { icon: <IconCheck size={22} />, text: t('iwallet.install.step3') },
  ];
  return (
    <Dialog open={open} onClose={onClose} title={t('iwallet.install.title')} icon={<IconAddSquare size={20} />}>
      <ol className="iw-install-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="iw-install-num" aria-hidden="true">{i + 1}</span>
            <span className="iw-install-icon">{s.icon}</span>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="iw-install-note">{t('iwallet.install.iosNote')}</p>
      <Link className="iw-link" to="/i-wallet/import" onClick={onClose}>{t('iwallet.unlock.restore')}</Link>
    </Dialog>
  );
}

// The "Add to Home Screen" button for a mode from useInstallMode; renders nothing where there is nothing to offer.
export function InstallButton({ mode, className = 'iw-secondary iw-install-btn' }: { mode: InstallMode; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (mode !== 'prompt' && mode !== 'ios') return null;
  const onClick = () => { if (mode === 'prompt') void prompt(); else setOpen(true); };
  return (
    <>
      <button type="button" className={className} onClick={onClick}><IconAddSquare size={20} />{t('iwallet.install.button')}</button>
      {mode === 'ios' && <IosSteps open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

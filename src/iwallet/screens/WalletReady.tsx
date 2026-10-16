import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enableFaceId } from '../saveWallet';
import '../iwallet.css';

// Shown after create/import when the Face ID switch was on. The password is kept only here until the user taps
// Enable, Continue or leaves; Face ID gets its own tap because WebAuthn on iOS needs a fresh user gesture.
export default function WalletReady({ password, onClear, onContinue }: {
  password: string | null; onClear(): void; onContinue(): void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = async () => {
    if (!password) return;
    setBusy(true);
    const r = await enableFaceId(password);
    setBusy(false);
    if (r.ok) { setEnabled(true); setNote(null); onClear(); return; }
    setNote(t(r.note));
    if (!r.retry) onClear();
  };
  const cont = () => { onClear(); onContinue(); };

  return (
    <div className="iw iw-wizard">
      <div className="iw-body">
        <h1 className="iw-h1">{t('iwallet.create.done')}</h1>
        {enabled && <p className="iw-note" role="status">{t('iwallet.faceid.enabled')}</p>}
        {note && <p className="iw-note" role="status">{note}</p>}
        {password && (
          <button type="button" className="iw-secondary" disabled={busy} onClick={() => void enable()}>
            {t('iwallet.faceid.enable')}
          </button>
        )}
        <button type="button" className="iw-primary" onClick={cont}>{t('iwallet.create.openWallet')}</button>
      </div>
    </div>
  );
}

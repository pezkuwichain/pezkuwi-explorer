import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../ui/PageHeader';
import { IconFaceId } from '../../ui/icons';
import { hasFaceId } from '../faceid';
import { CorruptKeystoreError, WrongPasswordError } from '../keystore';
import { useIWallet } from '../IWalletContext';
import '../iwallet.css';

// The locked wallet: password, plus Face ID when it was enrolled. A cancelled Face ID prompt leaves the password field.
export default function Unlock() {
  const { t } = useTranslation();
  const { unlock, unlockFaceId } = useIWallet();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrupt, setCorrupt] = useState(false);
  const [face, setFace] = useState(false);
  useEffect(() => {
    let live = true;
    hasFaceId().then((v) => { if (live) setFace(v); }, () => undefined);
    return () => { live = false; };
  }, []);

  const fail = (e: unknown) => {
    if (e instanceof CorruptKeystoreError) setCorrupt(true);
    else setError(t(e instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : 'iwallet.error.generic'));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setError(null);
    try { await unlock(pw); setPw(''); } catch (err) { fail(err); setBusy(false); }
  };
  const viaFace = async () => {
    setBusy(true); setError(null);
    try { await unlockFaceId(); } catch (err) { fail(err); }
    setBusy(false);
  };

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.locked.title')} />
      <div className="iw-body">
        <p className="iw-lead">{t('iwallet.unlock.body')}</p>
        {corrupt ? (
          <div className="iw-unavailable" role="alert">
            <p>{t('iwallet.unlock.corrupt')}</p>
            <Link className="iw-primary" to="/i-wallet/import">{t('iwallet.unlock.restore')}</Link>
          </div>
        ) : (
          <form className="iw-form" onSubmit={submit}>
            <label className="iw-field">
              <span>{t('iwallet.password.label')}</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <p className="iw-error" role="alert">{error}</p>}
            <button type="submit" className="iw-primary" disabled={!pw || busy}>
              {t(busy ? 'iwallet.unlock.working' : 'iwallet.unlock.submit')}
            </button>
            {face && (
              <button type="button" className="iw-secondary" disabled={busy} onClick={() => void viaFace()}>
                <IconFaceId size={20} /> {t('iwallet.faceid.title')}
              </button>
            )}
            <Link className="iw-link" to="/i-wallet/import">{t('iwallet.unlock.restore')}</Link>
          </form>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconBack } from '../../ui/icons';
import { isValidMnemonic, normaliseMnemonic } from '../keystore';
import { NotSavedError, saveWallet } from '../saveWallet';
import WalletReady from './WalletReady';
import { useIWallet } from '../IWalletContext';
import PasswordStep, { type PasswordResult } from './PasswordStep';
import '../iwallet.css';

// Opening a wallet from its 12 words: words, then the password step. When a wallet already exists on this device,
// saving first asks for a confirmation because it replaces that wallet.
export default function Import() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, setCreated } = useIWallet();
  const words = useRef('');
  const [text, setText] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState<PasswordResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facePw, setFacePw] = useState<string | null>(null);
  const clearFacePw = useCallback(() => setFacePw(null), []);
  const [done, setDone] = useState(false);

  useEffect(() => () => { words.current = ''; }, []);

  if (state === 'idle' || state === 'loading') return <p className="card-note" role="status">{t('state.loading')}</p>;
  if (state === 'unavailable' || state === 'loadFailed') return <Navigate to="/i-wallet" replace />;
  const replacing = state === 'locked' || state === 'unlocked';

  const next = () => {
    const m = normaliseMnemonic(text);
    if (!isValidMnemonic(m)) { setInvalid(true); return; }
    words.current = m; setText(''); setInvalid(false); setStep(2);
  };

  const save = async ({ password, faceId }: PasswordResult) => {
    setBusy(true); setError(null); setPending(null);
    try {
      const saved = await saveWallet(words.current, password, { replacing });
      words.current = '';
      setDone(true);
      setCreated(saved.json);
      if (faceId) { setFacePw(password); setBusy(false); } else navigate('/i-wallet', { replace: true });
    } catch (e) {
      setError(t(e instanceof NotSavedError ? 'iwallet.error.notSaved' : 'iwallet.error.generic'));
      setBusy(false);
    }
  };
  const submit = (r: PasswordResult) => { if (replacing) setPending(r); else void save(r); };

  if (done) {
    return <WalletReady password={facePw} onClear={clearFacePw} onContinue={() => navigate('/i-wallet', { replace: true })} />;
  }

  return (
    <div className="iw iw-wizard">
      <div className="iw-body">
        <div className="iw-steprow">
          <button type="button" className="back" onClick={() => { if (step === 1) navigate(-1); else { words.current = ''; setStep(1); } }} aria-label={t('app.back')}>
            <IconBack />
          </button>
        </div>
        {step === 1 ? (
          <>
            <h1 className="iw-h1">{t('iwallet.import.title')}</h1>
            <p className="iw-lead">{t('iwallet.import.body')}</p>
            <label className="iw-field">
              <span>{t('iwallet.import.label')}</span>
              <textarea
                rows={4} value={text} onChange={(e) => { setText(e.target.value); setInvalid(false); }}
                autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr"
              />
            </label>
            {invalid && <p className="iw-error" role="alert">{t('iwallet.import.invalid')}</p>}
            <button type="button" className="iw-primary" disabled={!text.trim()} onClick={next}>{t('iwallet.next')}</button>
          </>
        ) : (
          <>
            <h1 className="iw-h1">{t('iwallet.password.title')}</h1>
            <p className="iw-lead">{t('iwallet.password.body')}</p>
            {pending && (
              <div className="iw-redwarn" role="alertdialog" aria-label={t('iwallet.import.confirmTitle')}>
                <strong>{t('iwallet.import.confirmTitle')}</strong> {t('iwallet.import.confirmBody')}
                <div className="iw-confirm-actions">
                  <button type="button" className="iw-danger" onClick={() => void save(pending)}>{t('iwallet.import.confirmYes')}</button>
                  <button type="button" className="iw-secondary" onClick={() => setPending(null)}>{t('iwallet.import.confirmNo')}</button>
                </div>
              </div>
            )}
            {/* Stays mounted while the confirmation shows so a cancel keeps what the user typed. */}
            <div hidden={pending !== null}>
              <PasswordStep
                submitLabel={t(busy ? 'iwallet.create.working' : 'iwallet.import.submit')}
                busy={busy} error={error} onSubmit={submit}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { faceIdSupported } from '../faceid';
import { passwordStrength } from '../keystore';
import { IconFaceId } from '../../ui/icons';

export interface PasswordResult { password: string; faceId: boolean }

// The password step shared by create and import: password + repeat, strength bar, optional Face ID switch.
export default function PasswordStep({
  submitLabel, busy, error, onSubmit,
}: { submitLabel: string; busy: boolean; error: string | null; onSubmit(r: PasswordResult): void }) {
  const { t } = useTranslation();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [faceOn, setFaceOn] = useState(false);
  const [faceOk, setFaceOk] = useState(false);
  useEffect(() => {
    let live = true;
    faceIdSupported().then((v) => { if (live) setFaceOk(v); }, () => undefined);
    return () => { live = false; };
  }, []);
  const strength = passwordStrength(pw);
  const mismatch = again !== '' && again !== pw;
  const valid = strength >= 2 && pw === again;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !busy) onSubmit({ password: pw, faceId: faceOk && faceOn });
  };
  return (
    <form className="iw-form" onSubmit={submit}>
      <label className="iw-field">
        <span>{t('iwallet.password.label')}</span>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </label>
      <div className="iw-strength">
        <div className="iw-strength-bar" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => <span key={i} className={i <= strength ? `on s${strength}` : ''} />)}
        </div>
        {strength > 0 && <span role="status">{t(`iwallet.password.strength.${strength}`)}</span>}
      </div>
      <label className="iw-field">
        <span>{t('iwallet.password.repeat')}</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
      </label>
      {mismatch && <p className="iw-error" role="alert">{t('iwallet.password.mismatch')}</p>}
      {faceOk && (
        <div className="iw-faceid">
          <IconFaceId size={26} />
          <div className="iw-faceid-text">
            <strong>{t('iwallet.faceid.title')}</strong>
            <span>{t('iwallet.faceid.hint')}</span>
          </div>
          <button
            type="button" role="switch" aria-checked={faceOn} aria-label={t('iwallet.faceid.title')}
            className={faceOn ? 'iw-switch on' : 'iw-switch'} onClick={() => setFaceOn((v) => !v)}
          ><span /></button>
        </div>
      )}
      {error && <p className="iw-error" role="alert">{error}</p>}
      <button type="submit" className="iw-primary" disabled={!valid || busy}>{submitLabel}</button>
    </form>
  );
}

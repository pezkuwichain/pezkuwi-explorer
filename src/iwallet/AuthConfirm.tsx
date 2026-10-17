import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconFaceId } from '../ui/icons';
import { unlockWithFaceId } from './faceid';

// Password field + optional Face ID button, below a summary of exactly what will be signed (spec §8).
export function AuthConfirm({ summary, busy, blocked = false, error, face, onPassword, onFaceFailed, onBack, submitLabel }: {
  summary: ReactNode;
  busy: boolean;
  // Signing is not offered yet (e.g. the fee is not known); the caller says why in `summary` or `error`.
  blocked?: boolean;
  error: string | null;
  face: boolean;
  onPassword: (password: string) => void;
  onFaceFailed: () => void;
  onBack: () => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const [pw, setPw] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // After a failure (a wrong password) the person types again. The field is focused here, once React has re-enabled
  // it: the progress overlay's own fallback can run while the field is still disabled and find nothing to focus.
  useEffect(() => { if (error && !busy) input.current?.focus(); }, [error, busy]);
  const submitPw = (e: FormEvent) => { e.preventDefault(); if (pw && !busy && !blocked) { const p = pw; setPw(''); onPassword(p); } };
  const withFace = async () => {
    if (busy || blocked) return;
    const p = await unlockWithFaceId();
    if (p === null) { onFaceFailed(); return; }
    onPassword(p);
  };
  return (
    <form className="iw-body iw-form" onSubmit={submitPw}>
      {summary}
      <label className="iw-field">
        <span>{t('iwallet.password.label')}</span>
        <input ref={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" disabled={busy} />
      </label>
      {error && <p className="iw-error" role="alert">{error}</p>}
      <button type="submit" className="iw-primary" disabled={!pw || busy || blocked}>{busy ? t('iwallet.send.working') : submitLabel}</button>
      {face && (
        <button type="button" className="iw-secondary" disabled={busy || blocked} onClick={() => void withFace()}>
          <IconFaceId size={20} /> {t('iwallet.faceid.title')}
        </button>
      )}
      <button type="button" className="iw-secondary" disabled={busy} onClick={onBack}>{t('app.back')}</button>
    </form>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPen } from '../ui/icons';
import { clearPersonal, savePersonal, toPhotoDataUrl, type Personal } from './personal';

// Opens a small form under the card to add a photo and a name. Everything stays in this browser (see personal.ts).
export function PersonalEditor({ address, value, onChange }: { address: string; value: Personal; onChange(p: Personal): void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Personal>(value);
  const [error, setError] = useState<string | null>(null);
  const [notSaved, setNotSaved] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => { if (open) first.current?.focus(); }, [open]);

  const start = () => { setDraft(value); setError(null); setOpen(true); };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try { const photo = await toPhotoDataUrl(file); setDraft((d) => ({ ...d, photo })); }
    catch { setError(t('cid.notImage')); }
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    const p = { given: draft.given.trim().slice(0, 60), surname: draft.surname.trim().slice(0, 60), photo: draft.photo };
    // Shown either way; if the browser will not keep it, it lasts until the page is closed, and we say so.
    setNotSaved(!savePersonal(address, p));
    onChange(p);
    setOpen(false);
  };
  const clear = () => {
    clearPersonal(address);
    onChange({ given: '', surname: '', photo: null });
    setNotSaved(false);
    setOpen(false);
  };

  return (
    <div className="personal">
      <button type="button" className="btn btn-quiet personal-open" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => (open ? setOpen(false) : start())}>
        <IconPen size={18} />{t('cid.edit')}
      </button>
      <p className="personal-note">{t('cid.localNote')}</p>
      {notSaved && <p className="alert" role="status">{t('cid.notSaved')}</p>}
      {open && (
        <form id={`${id}-form`} className="personal-form" onSubmit={save} aria-label={t('cid.edit')}>
          <label className="personal-field">{t('cid.given')}
            <input ref={first} className="field personal-input" value={draft.given} maxLength={60} autoComplete="given-name"
              onChange={(e) => setDraft((d) => ({ ...d, given: e.target.value }))} />
          </label>
          <label className="personal-field">{t('cid.surname')}
            <input className="field personal-input" value={draft.surname} maxLength={60} autoComplete="family-name"
              onChange={(e) => setDraft((d) => ({ ...d, surname: e.target.value }))} />
          </label>
          <div className="personal-photo">
            {draft.photo && <img src={draft.photo} alt={t('cid.photoAlt')} width={56} height={70} />}
            <label className="btn btn-quiet personal-pick">{t('cid.choosePhoto')}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>
          </div>
          {error && <p role="alert" className="alert">{error}</p>}
          <div className="personal-actions">
            <button type="submit" className="btn btn-primary">{t('cid.save')}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>{t('cid.cancel')}</button>
          </div>
          <button type="button" className="btn btn-text" onClick={clear}>{t('cid.clear')}</button>
        </form>
      )}
    </div>
  );
}

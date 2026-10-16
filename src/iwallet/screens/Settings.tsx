import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../ui/PageHeader';
import { Dialog } from '../../ui/Dialog';
import { IconFaceId, IconLogOut, IconPen, IconShield, IconTrash } from '../../ui/icons';
import { faceIdSupported, forgetFaceId, hasFaceId } from '../faceid';
import { enableFaceId } from '../saveWallet';
import { CorruptKeystoreError, WrongPasswordError, verifyPassword } from '../keystore';
import { downloadJson, exportFileName } from '../download';
import { useIWallet } from '../IWalletContext';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

type View = 'menu' | 'password' | 'words' | 'facepw' | 'faceready';

function SettingsBody({ address }: { address: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { keystore, readWords, lock, remove } = useIWallet();
  const [view, setView] = useState<View>('menu');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The decrypted words exist only here, only while the words view is open; leaving the view or the screen drops them.
  const [words, setWords] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  // Face ID: shown only where supported. The verified password is kept only between the password prompt and the
  // separate enable tap (WebAuthn on iOS needs a fresh gesture), and dropped after.
  const [faceSupported, setFaceSupported] = useState(false);
  const [faceOn, setFaceOn] = useState(false);
  const [facePw, setFacePw] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    Promise.all([faceIdSupported(), hasFaceId()]).then(([s, h]) => { if (live) { setFaceSupported(s); setFaceOn(h); } }, () => undefined);
    return () => { live = false; };
  }, []);
  // Whatever secret is on screen goes as soon as the page is hidden, and the typed or verified password with it: the
  // words view, the password prompts and the Face ID enable step all return to the menu and must be asked for again.
  useEffect(() => {
    if (view === 'menu') return;
    const onVis = () => { if (document.hidden) { setWords([]); setPw(''); setFacePw(null); setError(null); setView('menu'); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [view]);
  // A view change unmounts the focused button; focus moves to the new view's heading.
  useEffect(() => { if (view !== 'menu') heading.current?.focus(); }, [view]);

  const go = (v: View) => { setView(v); setPw(''); setError(null); setWords([]); setFacePw(null); };

  const show = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setError(null);
    try {
      // Enabling Face ID needs only proof of the password, so the words are not decrypted for it.
      if (view === 'facepw') {
        if (!keystore) throw new Error('no keystore');
        await verifyPassword(keystore, pw);
        setFacePw(pw); setPw(''); setNote(null); setView('faceready');
      } else { setWords((await readWords(pw)).split(' ')); setPw(''); setView('words'); }
    } catch (err) {
      setError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
    }
    setBusy(false);
  };

  const enable = async () => {
    if (!facePw) return;
    setBusy(true);
    const r = await enableFaceId(facePw);
    setBusy(false);
    if (r.ok) { setFaceOn(true); go('menu'); setNote(t('iwallet.faceid.enabled')); return; }
    setNote(t(r.note));
    if (!r.retry) setFacePw(null);
  };
  const disable = async () => {
    const ok = await forgetFaceId();
    if (ok) { setFaceOn(false); setNote(t('iwallet.settings.faceDisabled')); } else setNote(t('iwallet.faceid.storage'));
  };

  const doDelete = async () => {
    setBusy(true); setDeleteError(false);
    try { await remove(); navigate('/i-wallet', { replace: true }); } catch { setDeleteError(true); setBusy(false); }
  };

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.settings.title')} />
      <div className="iw-body">
        {view === 'menu' && note && <p className="iw-note" role="status">{note}</p>}
        {view === 'menu' && (
          <ul className="iw-menu">
            <li><button type="button" onClick={() => go('password')}><IconShield size={20} /><span><strong>{t('iwallet.settings.backup')}</strong></span></button></li>
            <li><button type="button" disabled={!keystore} onClick={() => keystore && downloadJson(exportFileName(address), keystore)}>
              <IconPen size={20} /><span><strong>{t('iwallet.settings.export')}</strong><small>{t('iwallet.settings.exportBody')}</small></span>
            </button></li>
            {faceSupported && (
              <li><button type="button" onClick={() => { if (faceOn) void disable(); else { setNote(null); go('facepw'); } }}>
                <IconFaceId size={20} /><span><strong>{t(faceOn ? 'iwallet.settings.faceOff' : 'iwallet.faceid.enable')}</strong></span>
              </button></li>
            )}
            <li><button type="button" onClick={() => { lock(); }}><IconLogOut size={20} /><span><strong>{t('iwallet.settings.lock')}</strong></span></button></li>
            <li><button type="button" className="iw-menu-danger" onClick={() => { setDeleteError(false); setConfirmDelete(true); }}>
              <IconTrash size={20} /><span><strong>{t('iwallet.settings.delete')}</strong></span>
            </button></li>
          </ul>
        )}

        {(view === 'password' || view === 'facepw') && (
          <form className="iw-form" onSubmit={show}>
            <h2 className="iw-h1" tabIndex={-1} ref={heading}>{t(view === 'facepw' ? 'iwallet.faceid.enable' : 'iwallet.settings.backup')}</h2>
            <p className="iw-lead">{t(view === 'facepw' ? 'iwallet.settings.faceBody' : 'iwallet.settings.backupBody')}</p>
            <label className="iw-field">
              <span>{t('iwallet.password.label')}</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <p className="iw-error" role="alert">{error}</p>}
            <button type="submit" className="iw-primary" disabled={!pw || busy}>{t(view === 'facepw' ? 'iwallet.next' : 'iwallet.settings.show')}</button>
            <button type="button" className="iw-secondary" onClick={() => go('menu')}>{t('iwallet.import.confirmNo')}</button>
          </form>
        )}

        {view === 'faceready' && (
          <>
            <h2 className="iw-h1" tabIndex={-1} ref={heading}>{t('iwallet.faceid.enable')}</h2>
            {note && <p className="iw-note" role="status">{note}</p>}
            {facePw && <button type="button" className="iw-primary" disabled={busy} onClick={() => void enable()}>{t('iwallet.faceid.enable')}</button>}
            <button type="button" className="iw-secondary" onClick={() => go('menu')}>{t('iwallet.import.confirmNo')}</button>
          </>
        )}

        {view === 'words' && (
          <>
            <h2 className="iw-h1" tabIndex={-1} ref={heading}>{t('iwallet.words.title')}</h2>
            <ol className="iw-words" aria-label={t('iwallet.words.list')}>
              {words.map((w, i) => <li key={i}><span className="iw-n">{i + 1}</span><span>{w}</span></li>)}
            </ol>
            <div className="iw-redwarn" role="note"><strong>{t('iwallet.words.warnTitle')}</strong> {t('iwallet.words.warnBody')}</div>
            <button type="button" className="iw-primary" onClick={() => go('menu')}>{t('iwallet.settings.hide')}</button>
          </>
        )}
      </div>

      <Dialog open={confirmDelete} onClose={() => { if (!busy) setConfirmDelete(false); }} title={t('iwallet.settings.deleteTitle')} description={t('iwallet.settings.deleteBody')}>
        {deleteError && <p className="iw-error" role="alert">{t('iwallet.settings.deleteFailed')}</p>}
        <div className="iw-confirm-actions">
          <button type="button" className="iw-danger" disabled={busy} onClick={() => void doDelete()}>{t('iwallet.settings.deleteConfirm')}</button>
          <button type="button" className="iw-secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>{t('iwallet.import.confirmNo')}</button>
        </div>
      </Dialog>
    </div>
  );
}

export default function Settings() {
  return <RequireUnlocked>{(address) => <SettingsBody address={address} />}</RequireUnlocked>;
}

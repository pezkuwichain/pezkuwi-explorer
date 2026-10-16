import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../ui/PageHeader';
import { Dialog } from '../../ui/Dialog';
import { IconLogOut, IconPen, IconShield } from '../../ui/icons';
import { CorruptKeystoreError, WrongPasswordError } from '../keystore';
import { downloadJson, exportFileName } from '../download';
import { useIWallet } from '../IWalletContext';
import RequireUnlocked from '../RequireUnlocked';
import '../iwallet.css';

type View = 'menu' | 'password' | 'words';

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
  useEffect(() => () => setWords([]), []);

  const go = (v: View) => { setView(v); setPw(''); setError(null); setWords([]); };

  const show = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setError(null);
    try {
      const m = await readWords(pw);
      setWords(m.split(' ')); setPw(''); setView('words');
    } catch (err) {
      setError(t(err instanceof WrongPasswordError ? 'iwallet.error.wrongPassword' : err instanceof CorruptKeystoreError ? 'iwallet.unlock.corrupt' : 'iwallet.error.generic'));
    }
    setBusy(false);
  };

  const doDelete = async () => {
    setBusy(true); setDeleteError(false);
    try { await remove(); navigate('/i-wallet', { replace: true }); } catch { setDeleteError(true); setBusy(false); }
  };

  return (
    <div className="iw">
      <PageHeader title={t('iwallet.settings.title')} />
      <div className="iw-body">
        {view === 'menu' && (
          <ul className="iw-menu">
            <li><button type="button" onClick={() => go('password')}><IconShield size={20} /><span><strong>{t('iwallet.settings.backup')}</strong></span></button></li>
            <li><button type="button" disabled={!keystore} onClick={() => keystore && downloadJson(exportFileName(address), keystore)}>
              <IconPen size={20} /><span><strong>{t('iwallet.settings.export')}</strong><small>{t('iwallet.settings.exportBody')}</small></span>
            </button></li>
            <li><button type="button" onClick={() => { lock(); }}><IconLogOut size={20} /><span><strong>{t('iwallet.settings.lock')}</strong></span></button></li>
            <li><button type="button" className="iw-menu-danger" onClick={() => { setDeleteError(false); setConfirmDelete(true); }}>
              <IconLogOut size={20} /><span><strong>{t('iwallet.settings.delete')}</strong></span>
            </button></li>
          </ul>
        )}

        {view === 'password' && (
          <form className="iw-form" onSubmit={show}>
            <h2 className="iw-h1">{t('iwallet.settings.backup')}</h2>
            <p className="iw-lead">{t('iwallet.settings.backupBody')}</p>
            <label className="iw-field">
              <span>{t('iwallet.password.label')}</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <p className="iw-error" role="alert">{error}</p>}
            <button type="submit" className="iw-primary" disabled={!pw || busy}>{t('iwallet.settings.show')}</button>
            <button type="button" className="iw-secondary" onClick={() => go('menu')}>{t('iwallet.import.confirmNo')}</button>
          </form>
        )}

        {view === 'words' && (
          <>
            <h2 className="iw-h1">{t('iwallet.words.title')}</h2>
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

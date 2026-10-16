import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconBack } from '../../ui/icons';
import { newMnemonic, quizIndices, quizOptions } from '../keystore';
import { NotSavedError, saveWallet } from '../saveWallet';
import { useIWallet } from '../IWalletContext';
import PasswordStep, { type PasswordResult } from './PasswordStep';
import '../iwallet.css';

type Step = 1 | 2 | 3;

// Creating a wallet (spec §4): write down the 12 words, prove it with a 3-word quiz, then set the password. The
// mnemonic lives only in this component's state and is dropped on unmount and after success.
export default function Create() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, setCreated } = useIWallet();
  // The only copy of the mnemonic: component state, emptied after success; it goes away with the component.
  const [words, setWords] = useState<string[]>(() => newMnemonic().split(' '));
  const [step, setStep] = useState<Step>(1);
  const [ack, setAck] = useState(false);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const indices = useMemo(() => quizIndices(), []);
  const options = useMemo(() => indices.map((i) => quizOptions(words, i)), [indices, words]);

  if (state === 'idle' || state === 'loading') return <p className="card-note" role="status">{t('state.loading')}</p>;
  // An existing wallet is never overwritten from here (import asks for a confirmation); storage problems show the landing.
  if (!done && state !== 'none') return <Navigate to="/i-wallet" replace />;

  const pick = (slot: number, index: number, word: string) => {
    setPicks((p) => ({ ...p, [slot]: word }));
    setWrong((w) => { const n = new Set(w); if (word === words[index]) n.delete(slot); else n.add(slot); return n; });
  };
  const quizOk = indices.every((index, slot) => picks[slot] === words[index]);

  const back = () => { if (step === 1) navigate(-1); else setStep((s) => (s - 1) as Step); };

  const create = async ({ password, faceId }: PasswordResult) => {
    setBusy(true); setError(null);
    try {
      const saved = await saveWallet(words.join(' '), password, { faceId, replacing: false });
      setWords([]);
      setDone(true);
      setCreated(saved.json, saved.pair);
      if (saved.note) { setNote(t(saved.note)); setBusy(false); } else navigate('/i-wallet', { replace: true });
    } catch (e) {
      setError(t(e instanceof NotSavedError ? 'iwallet.error.notSaved' : 'iwallet.error.generic'));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="iw iw-wizard">
        <div className="iw-body">
          <h1 className="iw-h1">{t('iwallet.create.done')}</h1>
          {note && <p className="iw-note" role="status">{note}</p>}
          <button type="button" className="iw-primary" onClick={() => navigate('/i-wallet', { replace: true })}>
            {t('iwallet.create.openWallet')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="iw iw-wizard">
      <div className="iw-body">
        <div className="iw-steprow">
          <button type="button" className="back" onClick={back} aria-label={t('app.back')}><IconBack /></button>
          <span>{t('iwallet.wizard.step', { n: step })}</span>
        </div>
        <div className="iw-progress" aria-hidden="true">
          {[1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
        </div>

        {step === 1 && (
          <>
            <h1 className="iw-h1">{t('iwallet.words.title')}</h1>
            <p className="iw-lead">{t('iwallet.words.body')}</p>
            <ol className="iw-words" aria-label={t('iwallet.words.list')}>
              {words.map((w, i) => <li key={i}><span className="iw-n">{i + 1}</span><span>{w}</span></li>)}
            </ol>
            <div className="iw-redwarn" role="note">
              <strong>{t('iwallet.words.warnTitle')}</strong> {t('iwallet.words.warnBody')}
            </div>
            <label className="iw-check">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>{t('iwallet.words.ack')}</span>
            </label>
            <button type="button" className="iw-primary" disabled={!ack} onClick={() => setStep(2)}>{t('iwallet.next')}</button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="iw-h1">{t('iwallet.quiz.title')}</h1>
            <p className="iw-lead">{t('iwallet.quiz.body')}</p>
            {indices.map((index, slot) => (
              <div key={index} className="iw-quiz">
                <span className="iw-quiz-label">{t('iwallet.quiz.slot', { n: index + 1 })}</span>
                <div className="iw-quiz-opts" role="group" aria-label={t('iwallet.quiz.slot', { n: index + 1 })}>
                  {options[slot].map((o) => (
                    <button
                      key={o} type="button" aria-pressed={picks[slot] === o}
                      className={picks[slot] === o ? (wrong.has(slot) ? 'iw-opt bad' : 'iw-opt on') : 'iw-opt'}
                      onClick={() => pick(slot, index, o)}
                    >{o}</button>
                  ))}
                </div>
                {wrong.has(slot) && <p className="iw-error" role="alert">{t('iwallet.quiz.wrong')}</p>}
              </div>
            ))}
            <button type="button" className="iw-primary" disabled={!quizOk} onClick={() => setStep(3)}>{t('iwallet.quiz.verify')}</button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="iw-h1">{t('iwallet.password.title')}</h1>
            <p className="iw-lead">{t('iwallet.password.body')}</p>
            <PasswordStep
              submitLabel={t(busy ? 'iwallet.create.working' : 'iwallet.create.submit')}
              busy={busy} error={error} onSubmit={create}
            />
          </>
        )}
      </div>
    </div>
  );
}

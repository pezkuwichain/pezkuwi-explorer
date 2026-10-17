import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import { IconCheck, IconCross } from '../ui/icons';
import { ProgressOverlay } from '../ui/ProgressOverlay';
import CopyAddress from './CopyAddress';
import type { TxOutcome, TxPhase, useSignedTx } from './useSignedTx';

// Where focus goes when the overlay closes over the result: its title (done, failed), else the screen's heading.
const resultHeading = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.iw-result .iw-h1') ?? document.querySelector<HTMLElement>('.iw .page-header h1');

const PHASE_MESSAGE: Record<TxPhase, string> = { signing: 'iwallet.signing', sending: 'iwallet.broadcasting', inBlock: 'iwallet.send.inBlock' };

// The Kurdistan-sun overlay of a signed action, from the password to a final answer (useSignedTx). A screen renders it
// at the same place in every one of its returns (first child), so it is one overlay from the confirm form to the
// result. Once the action is with the network it can be hidden ("continue in background"): the button after a short
// wait, Escape at once. While the key is being decrypted it cannot.
export function TxProgress({ progress }: { progress: ReturnType<typeof useSignedTx>['progress'] }) {
  const { t } = useTranslation();
  if (!progress) return null;
  const onChain = progress.phase !== 'signing';
  return (
    <ProgressOverlay
      message={t(progress.phase === 'inBlock' && progress.likelyFailed ? 'iwallet.send.likelyFailed' : PHASE_MESSAGE[progress.phase])}
      failed={progress.failed}
      focusAfter={resultHeading}
      dismiss={onChain ? { label: t('iwallet.background'), ready: progress.canHide, onDismiss: progress.hide } : undefined}
    />
  );
}

// The result screen shared by Send and Citizen: on its way, accepted, final (with the transaction code), failed, or
// unknown. It shows no secret, so it may stay on screen through an auto-lock (see RequireUnlocked).
export function TxResult({ title, outcome, doneTitle, failedTitle, interrupted, detail, actions }: {
  title: string;
  outcome: Exclude<TxOutcome, { kind: 'idle' }>;
  doneTitle: string;
  failedTitle: string;
  /** The "may still complete, check before trying again" text. */
  interrupted: string;
  /** Extra lines under the finalized title (what was sent, the record number). */
  detail?: ReactNode;
  actions: ReactNode;
}) {
  const { t } = useTranslation();
  const o = outcome;
  return (
    <div className="iw">
      <PageHeader title={title} />
      <div className="iw-body iw-result" aria-live="polite">
        {o.kind === 'pending' && <p className="iw-lead" role="status">{t('iwallet.send.pending')}</p>}
        {o.kind === 'inBlock' && <p className="iw-lead" role="status">{t(o.likelyFailed ? 'iwallet.send.likelyFailed' : 'iwallet.send.inBlock')}</p>}
        {o.kind === 'slow' && <p className="iw-note" role="status">{t('iwallet.send.slow')}</p>}
        {o.kind === 'finalized' && <>
          <span className="iw-result-icon"><IconCheck size={32} /></span>
          <h2 className="iw-h1">{doneTitle}</h2>
          {detail}
          <p className="iw-lead">{t('iwallet.send.txId')}</p>
          <div className="iw-addr iw-addr-full">
            <bdi dir="ltr" className="iw-addr-text">{o.hash}</bdi>
            <CopyAddress address={o.hash} label={t('iwallet.send.copyTxId')} />
          </div>
        </>}
        {o.kind === 'failed' && <>
          <span className="iw-result-icon bad"><IconCross size={32} /></span>
          <h2 className="iw-h1">{failedTitle}</h2>
          <p className="iw-error" role="alert">{o.message}</p>
        </>}
        {o.kind === 'interrupted' && <p className="iw-note" role="alert">{interrupted}</p>}
        {actions}
      </div>
    </div>
  );
}

// Still on its way: leaving is allowed (Done) but starting another action is not.
export const txSettled = (o: TxOutcome): boolean => o.kind !== 'pending' && o.kind !== 'inBlock';

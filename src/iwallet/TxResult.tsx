import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import { IconCheck, IconCross } from '../ui/icons';
import CopyAddress from './CopyAddress';
import type { TxOutcome } from './useSignedTx';

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
        {o.kind === 'inBlock' && <p className="iw-lead" role="status">{t('iwallet.send.inBlock')}</p>}
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

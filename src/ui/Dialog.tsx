import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCross } from './icons';
import './dialog.css';

// Body scroll is locked while any dialog is open; a dialog opened over another keeps the lock until both close.
let locks = 0;
const LOCK_CLASS = 'dialog-open';
function lockScroll() { locks += 1; document.documentElement.classList.add(LOCK_CLASS); }
function unlockScroll() { locks = Math.max(0, locks - 1); if (locks === 0) document.documentElement.classList.remove(LOCK_CLASS); }

type Props = { open: boolean; onClose(): void; title: ReactNode; description?: ReactNode; icon?: ReactNode; children: ReactNode };

// A modal dialog on the native <dialog> element (showModal: the browser keeps focus inside and puts it in the
// top layer). Escape and a tap on the backdrop close it; focus goes back to whatever opened it. Nothing is
// rendered while closed. On a phone it sits at the bottom of the screen as a sheet (dialog.css).
export function Dialog({ open, onClose, title, description, icon, children }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!open || !d) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!d.open) d.showModal();
    lockScroll();
    // Escape fires cancel; the parent decides, so the dialog never closes behind React's back.
    const onCancel = (e: Event) => { e.preventDefault(); closeRef.current(); };
    d.addEventListener('cancel', onCancel);
    return () => {
      d.removeEventListener('cancel', onCancel);
      if (d.open) d.close();
      unlockScroll();
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    // The click lands on the <dialog> itself only on the backdrop: the content fills the box inside it.
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog-body">
        <header className="dialog-head">
          <h2 id={titleId} className="dialog-title">{icon && <span className="dialog-icon" aria-hidden="true">{icon}</span>}{title}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label={t('dialog.close')}><IconCross size={20} /></button>
        </header>
        {description && <p id={descId} className="dialog-desc">{description}</p>}
        {children}
      </div>
    </dialog>
  );
}

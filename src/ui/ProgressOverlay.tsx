import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { KurdistanSun } from './KurdistanSun';
import './ProgressOverlay.css';

const usable = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && !(el as HTMLButtonElement).disabled && !el.closest('[inert]');

// After a failure (a wrong password) the person types again: the first enabled field near where they were, or the
// error itself when there is no field.
function fieldOrError(before: HTMLElement | null): HTMLElement | null {
  const form = before?.isConnected ? before.closest('form') : null;
  const scope: ParentNode = form ?? document.querySelector('main') ?? document.body;
  const el = scope.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), [role="alert"]');
  if (el && el.getAttribute('role') === 'alert' && !el.hasAttribute('tabindex')) el.tabIndex = -1;
  return el;
}

// A full-screen wait: dimmed backdrop, a card with the Kurdistan sun and one line (the miniapp's processing popup).
// It is rendered over the whole page; everything else is inert (no pointer, no focus, out of the accessibility tree)
// while it shows. It takes focus and keeps it. When it goes, focus returns where it was, or, after a failure
// (`failed()`), to the field to try again.
export function ProgressOverlay({ message, failed = () => false }: { message: string; failed?: () => boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const failedRef = useRef(failed);
  useEffect(() => { failedRef.current = failed; });
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const hostEl = host.current;
    const hidden: Array<{ el: Element; aria: string | null }> = [];
    for (const el of Array.from(document.body.children)) {
      if (el === hostEl || el.hasAttribute('inert')) continue;
      hidden.push({ el, aria: el.getAttribute('aria-hidden') });
      el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true');
    }
    card.current?.focus();
    return () => {
      for (const { el, aria } of hidden) {
        el.removeAttribute('inert');
        if (aria === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', aria);
      }
      // After the screen behind has taken the outcome (its error, its re-enabled controls).
      const wasFailure = failedRef.current();
      setTimeout(() => {
        const now = document.activeElement;
        if (now && now !== document.body && now.isConnected && !hostEl?.contains(now)) return; // already placed
        const target = wasFailure ? fieldOrError(before) : (usable(before) ? before : null);
        target?.focus();
      }, 0);
    };
  }, []);
  return createPortal(
    <div ref={host} className="progress-overlay">
      <div
        ref={card} className="progress-card" role="status" aria-live="polite" tabIndex={-1}
        onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }}
      >
        <KurdistanSun size={100} />
        <p className="progress-message">{message}</p>
      </div>
    </div>,
    document.body,
  );
}

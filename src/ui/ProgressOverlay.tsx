import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
// while it shows, including what is added to <body> meanwhile. It takes focus and keeps it. When it goes, focus
// returns where it was; after a failure (`failed()`) the screen behind focuses its own field (AuthConfirm, Unlock),
// and this only falls back to the first usable field or the error.
// The message may change while it shows (a transaction's steps); the card is a polite live region, so each new line is
// announced once. `dismiss` offers a way out that cancels nothing (the wait goes on behind): `dismiss.ready` shows its
// button, and while `dismiss` is given Escape does the same.
export function ProgressOverlay({ message, failed = () => false, dismiss }: {
  message: string;
  failed?: () => boolean;
  dismiss?: { label: string; ready: boolean; onDismiss: () => void };
}) {
  const host = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const failedRef = useRef(failed);
  const dismissRef = useRef(dismiss);
  useEffect(() => { failedRef.current = failed; dismissRef.current = dismiss; });
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const hostEl = host.current;
    const hidden: Array<{ el: Element; aria: string | null }> = [];
    const hide = (el: Element) => {
      if (el === hostEl || el.hasAttribute('inert')) return;
      hidden.push({ el, aria: el.getAttribute('aria-hidden') });
      el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true');
    };
    Array.from(document.body.children).forEach(hide);
    // Anything added to <body> while the overlay shows (a portal, a toast) is made inert too, and restored with the rest.
    const watch = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element && n.parentNode === document.body) hide(n); });
    });
    watch.observe(document.body, { childList: true });
    // On the document, so it works wherever focus is (a click on the backdrop leaves it on <body>).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissRef.current) { e.preventDefault(); dismissRef.current.onDismiss(); }
    };
    document.addEventListener('keydown', onKey);
    card.current?.focus();
    return () => {
      watch.disconnect();
      document.removeEventListener('keydown', onKey);
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
  // Focus stays in the card: Tab moves only between the card and its button, when there is one.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const b = button.current;
    if (b) (document.activeElement === b ? card.current : b)?.focus();
  };
  return createPortal(
    <div ref={host} className="progress-overlay">
      <div ref={card} className="progress-card" role="status" aria-live="polite" tabIndex={-1} onKeyDown={onKeyDown}>
        <KurdistanSun size={100} />
        <p className="progress-message">{message}</p>
        {dismiss?.ready && (
          <button ref={button} type="button" className="progress-dismiss" onClick={() => dismiss.onDismiss()}>{dismiss.label}</button>
        )}
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useRef } from 'react';
import { KurdistanSun } from './KurdistanSun';
import './ProgressOverlay.css';

// A full-screen wait: dimmed backdrop, a card with the Kurdistan sun and one line (the miniapp's processing popup).
// It takes focus while shown and keeps it, so nothing behind it can be used, and gives it back when it goes.
export function ProgressOverlay({ message }: { message: string }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    card.current?.focus();
    return () => { if (before && before.isConnected) before.focus(); };
  }, []);
  return (
    <div className="progress-overlay">
      <div
        ref={card} className="progress-card" role="status" aria-live="polite" tabIndex={-1}
        onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }}
      >
        <KurdistanSun size={100} />
        <p className="progress-message">{message}</p>
      </div>
    </div>
  );
}

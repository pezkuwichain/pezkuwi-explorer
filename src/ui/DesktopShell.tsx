import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedia } from '../hooks/useMedia';
import { IconExternal } from './icons';
import { NETWORK_ID, networkLabelKey } from '../config/network';
import './desktop.css';

export const DESKTOP = '(min-width: 900px)';
const FRAME_H = 844;

// The six mascot cards around the phone (the owner's own art). Order: three on the start side, three on the end.
const MASCOTS = [
  { img: 'pez3', alt: 'alt1', text: ['hello', 'say1'], tone: 'white', big: true },
  { img: 'pez6', alt: 'alt2', text: ['say2'], tone: 'zer', big: false },
  { img: 'pez4', alt: 'alt3', text: ['say3'], tone: 'glass', big: false },
  { img: 'pez5', alt: 'alt4', text: ['say4'], tone: 'kesk', big: true },
  { img: 'pez7', alt: 'alt5', text: ['say5'], tone: 'white', big: false },
  { img: 'pez2', alt: 'alt6', text: ['say6'], tone: 'glass', big: false },
] as const;

function Mascot({ m, i }: { m: (typeof MASCOTS)[number]; i: number }) {
  const { t } = useTranslation();
  return (
    <figure className={`mascot mascot-${i % 3}${m.big ? ' mascot-big' : ''}`}>
      {/* Only rendered on desktop, and lazy: a phone never asks for these pictures. */}
      <img src={`/mascots/${m.img}.jpg`} alt={t(`mascot.${m.alt}`)} loading="lazy" decoding="async" width={640} height={470} />
      <figcaption className={`bubble bubble-${m.tone}`}>
        {m.text.length === 2 ? <><strong>{t(`mascot.${m.text[0]}`)}</strong><br /><span>{t(`mascot.${m.text[1]}`)}</span></> : t(`mascot.${m.text[0]}`, { network: t(networkLabelKey(NETWORK_ID)) })}
      </figcaption>
    </figure>
  );
}

// The phone frame shrinks to fit short windows (never grows past its real size).
function useFrameScale(enabled: boolean): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!enabled) return;
    const fit = () => setScale(Math.min(1, (window.innerHeight - 140) / FRAME_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [enabled]);
  return Math.max(0.5, scale);
}

// At 900px and wider the app runs inside a phone frame with the mascots around it; below that, the app alone.
export function DesktopShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const desktop = useMedia(DESKTOP);
  const scale = useFrameScale(desktop);
  if (!desktop) return <>{children}</>;
  return (
    <div className="desk">
      <header className="desk-head">
        <img src="/brand/newroz-flame.svg" alt="" width={34} height={34} />
        <span className="desk-name">Pezkuwi Explorer</span>
        <a className="desk-experts" href="https://apps.pezkuwichain.io" rel="noopener">{t('app.expertsShort')} <IconExternal size={16} /></a>
      </header>
      <aside className="desk-side desk-start">{MASCOTS.slice(0, 3).map((m, i) => <Mascot key={m.img} m={m} i={i} />)}</aside>
      <div className="phone" style={{ transform: `translateX(-50%) scale(${scale})` }}>
        {/* The screen is the containing block for the app's fixed tab bar, so it stays inside the frame. */}
        <div className="phone-screen">
          <div className="phone-scroll">{children}</div>
          <span className="phone-notch" aria-hidden="true" />
        </div>
      </div>
      <aside className="desk-side desk-end">{MASCOTS.slice(3).map((m, i) => <Mascot key={m.img} m={m} i={i} />)}</aside>
      <p className="desk-foot">explorer.pezkuwichain.io</p>
    </div>
  );
}

import type { ReactNode } from 'react';

// One outline set: 24-unit grid, 2px stroke, round caps and joins (paths taken from the approved mockup).
type P = { size?: number; stroke?: number; className?: string };
const Svg = ({ size = 24, stroke = 2, className, children }: P & { children: ReactNode }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);

export const IconHome = (p: P) => <Svg {...p}><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></Svg>;
export const IconWallet = (p: P) => <Svg {...p}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" /></Svg>;
export const IconActivity = (p: P) => (
  <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" /><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M17 13h.01" /></Svg>
);
export const IconId = (p: P) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="11" r="2.5" /><path d="M5.5 17c.8-2 2-3 3.5-3s2.7 1 3.5 3" /><path d="M15 10h3" /><path d="M15 14h3" /></Svg>
);
export const IconIdTab = (p: P) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="11" r="2.5" /><path d="M15 10h3" /><path d="M15 14h3" /></Svg>
);
export const IconSignal = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4" /><path d="M19.1 4.9a10 10 0 0 1 0 14.2" /><path d="M4.9 19.1a10 10 0 0 1 0-14.2" /></Svg>
);
export const IconSignalTab = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4" /></Svg>
);
export const IconSend = (p: P) => <Svg {...p}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>;
export const IconGlobe = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20" /></Svg>;
// Chevrons point toward the start / end of the line; the logical-direction CSS mirrors them for RTL.
export const IconBack = (p: P) => <Svg {...p} className="flip"><path d="M15 18l-6-6 6-6" /></Svg>;
export const IconNext = (p: P) => <Svg {...p} className="flip"><path d="M9 18l6-6-6-6" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
export const IconReceived = (p: P) => <Svg {...p}><path d="M17 7L7 17" /><path d="M17 17H7V7" /></Svg>;
export const IconSent = (p: P) => <Svg {...p}><path d="M7 17L17 7" /><path d="M7 7h10v10" /></Svg>;
export const IconFailed = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6" /><path d="M9 9l6 6" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IconCross = (p: P) => <Svg {...p}><path d="M18 6L6 18" /><path d="M6 6l12 12" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconScan = (p: P) => (
  <Svg {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></Svg>
);
export const IconPaste = (p: P) => <Svg {...p}><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></Svg>;
export const IconBank = (p: P) => (
  <Svg {...p}><path d="M3 10l9-6 9 6" /><path d="M5 10v8" /><path d="M9.5 10v8" /><path d="M14.5 10v8" /><path d="M19 10v8" /><path d="M3 20h18" /></Svg>
);
export const IconPerson = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>;
export const IconHall = (p: P) => <Svg {...p}><path d="M4 19h16" /><path d="M6 19V9l6-5 6 5v10" /><path d="M10 19v-5h4v5" /></Svg>;
export const IconLines = (p: P) => <Svg {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></Svg>;
export const IconExternal = (p: P) => <Svg {...p}><path d="M7 17L17 7" /><path d="M7 7h10v10" /></Svg>;

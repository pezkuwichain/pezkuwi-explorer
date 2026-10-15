import type { ReactNode } from 'react';

const Svg = ({ size = 48, children }: { size?: number; children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);

export const IconWallet = () => (
  <Svg><rect x="6" y="12" width="36" height="26" rx="5" /><path d="M6 20h36" /><circle cx="33" cy="30" r="2" /></Svg>
);
export const IconArrow = () => (
  <Svg><path d="M8 24h30" /><path d="M28 14l10 10-10 10" /></Svg>
);
export const IconId = () => (
  <Svg><rect x="5" y="10" width="38" height="28" rx="5" /><circle cx="18" cy="22" r="4" /><path d="M11 33c1-4 4-6 7-6s6 2 7 6" /><path d="M30 20h8M30 28h8" /></Svg>
);
export const IconSignal = () => (
  <Svg><circle cx="24" cy="32" r="3" /><path d="M14 24a14 14 0 0 1 20 0" /><path d="M8 17a22 22 0 0 1 32 0" /></Svg>
);
// Points toward the start of the line; the logical-direction CSS mirrors it for RTL.
export const IconBack = () => (
  <svg className="icon-back" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>
);

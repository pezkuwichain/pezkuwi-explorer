import { useEffect, useState } from 'react';

// pwap's use-mobile: a window narrower than 768 px is a phone (the wallet dialogs offer the mobile way only).
export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < MOBILE_BREAKPOINT);
    update();
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  return mobile;
}

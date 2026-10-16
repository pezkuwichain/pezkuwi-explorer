// True when the page runs from the Home Screen (installed PWA), where Safari does not evict site data.
export function isStandalone(): boolean {
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) return true;
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

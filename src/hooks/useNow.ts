import { useCallback, useEffect, useState } from 'react';

// Relative times ("2 minutes ago") are computed against this clock, so it must not stay at the moment the screen opened.
export const NOW_REFRESH_MS = 60_000;

// Unix seconds, refreshed every NOW_REFRESH_MS while mounted; call refresh() when fresh data arrives.
export function useNow(): [number, () => void] {
  const [now, setNow] = useState(() => Date.now() / 1000);
  const refresh = useCallback(() => setNow(Date.now() / 1000), []);
  useEffect(() => {
    const id = setInterval(refresh, NOW_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);
  return [now, refresh];
}

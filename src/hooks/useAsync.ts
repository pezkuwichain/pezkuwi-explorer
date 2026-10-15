import { useCallback, useEffect, useState } from 'react';
type State<T> = { status: 'loading' | 'ok' | 'error'; data?: T };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    fn().then((data) => live && setState({ status: 'ok', data }), () => live && setState({ status: 'error' }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, retry };
}

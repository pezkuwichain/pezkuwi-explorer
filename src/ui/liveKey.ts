export type LiveKey = 'up' | 'down' | 'checking';

// Rule: loading -> checking; live === true -> up; anything else (down, null, failed load) -> down.
export const liveKey = (status: 'loading' | 'ok' | 'error', live?: boolean | null): LiveKey =>
  status === 'loading' ? 'checking' : status === 'ok' && live === true ? 'up' : 'down';

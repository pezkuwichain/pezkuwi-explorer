// Per-device conveniences only. Private browsing may throw on any access.
const PREFIX = 'pezkuwi-explorer:';
export const storage = {
  get(k: string): string | null { try { return localStorage.getItem(PREFIX + k); } catch { return null; } },
  // true when it was stored; false when this browser would not keep it.
  set(k: string, v: string): boolean { try { localStorage.setItem(PREFIX + k, v); return true; } catch { return false; } },
  remove(k: string): void { try { localStorage.removeItem(PREFIX + k); } catch { /* nothing to remove */ } },
};

// Per-device conveniences only. Private browsing may throw on any access.
const PREFIX = 'pezkuwi-explorer:';
export const storage = {
  get(k: string): string | null { try { return localStorage.getItem(PREFIX + k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(PREFIX + k, v); } catch { /* not remembered */ } },
  remove(k: string): void { try { localStorage.removeItem(PREFIX + k); } catch { /* nothing to remove */ } },
};

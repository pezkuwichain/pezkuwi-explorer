import { useSyncExternalStore } from 'react';
import { canPrompt, isIos, isStandalone, subscribeInstall } from '../ui/install';

// What "Add to Home Screen" can do here: nothing when already on the Home Screen; the browser's own install dialog
// (Chromium); the Share-sheet steps (iOS, which has no API); or nothing but the hint text (any other browser).
export type InstallMode = 'standalone' | 'prompt' | 'ios' | 'none';

export function useInstallMode(): InstallMode {
  const can = useSyncExternalStore(subscribeInstall, canPrompt, () => false);
  if (isStandalone()) return 'standalone';
  if (can) return 'prompt';
  return isIos() ? 'ios' : 'none';
}

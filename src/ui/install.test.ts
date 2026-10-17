import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canPrompt, isIos, prompt, resetInstallForTests, startInstallCapture, subscribeInstall } from './install';

function fakeInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(e, { prompt: vi.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome }) });
}

const nav = (ua: string, platform = '', touch = 0) => ({ userAgent: ua, platform, maxTouchPoints: touch }) as unknown as Navigator;

describe('install prompt capture', () => {
  beforeEach(() => { resetInstallForTests(); startInstallCapture(); });
  afterEach(() => resetInstallForTests());

  it('keeps the event, suppresses the browser infobar and tells subscribers', () => {
    const seen = vi.fn();
    const off = subscribeInstall(seen);
    expect(canPrompt()).toBe(false);
    const e = fakeInstallEvent();
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(canPrompt()).toBe(true);
    expect(seen).toHaveBeenCalled();
    off();
  });

  it('prompts once with the kept event, then has nothing left to offer', async () => {
    const e = fakeInstallEvent('dismissed');
    window.dispatchEvent(e);
    expect(await prompt()).toBe('dismissed');
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(canPrompt()).toBe(false);
    expect(await prompt()).toBe('unavailable');
  });

  it('drops the event once the app is installed', () => {
    window.dispatchEvent(fakeInstallEvent());
    window.dispatchEvent(new Event('appinstalled'));
    expect(canPrompt()).toBe(false);
  });
});

describe('isIos', () => {
  it('is true for iPhone and iPad user agents, and for iPadOS reporting a touch Mac', () => {
    expect(isIos(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'))).toBe(true);
    expect(isIos(nav('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'))).toBe(true);
    expect(isIos(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 'MacIntel', 5))).toBe(true);
  });
  it('is false for a desktop Mac, Android and desktop Firefox', () => {
    expect(isIos(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 'MacIntel', 0))).toBe(false);
    expect(isIos(nav('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile', 'Linux armv8l', 5))).toBe(false);
    expect(isIos(nav('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Linux x86_64'))).toBe(false);
  });
});

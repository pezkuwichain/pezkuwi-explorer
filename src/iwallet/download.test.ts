import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadJson, exportFileName } from './download';
import { isStandalone } from './standalone';

describe('export', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('names the file after the first six characters of the address', () => {
    expect(exportFileName('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).toBe('i-wallet-5Grwva….json');
  });

  it('downloads the JSON through a blob URL and revokes it afterwards', async () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    downloadJson('i-wallet-5Grwva….json', { address: 'x' });
    expect(create).toHaveBeenCalledTimes(1);
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(await blob.text()).toContain('"address": "x"');
    expect(name).toBe('i-wallet-5Grwva….json');
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});

describe('isStandalone', () => {
  const mm = (matches: boolean) => { window.matchMedia = ((q: string) => ({ matches: matches && q.includes('standalone') })) as never; };
  afterEach(() => { Object.defineProperty(navigator, 'standalone', { configurable: true, value: undefined }); });
  it('is true when display-mode is standalone', () => { mm(true); expect(isStandalone()).toBe(true); });
  it('is true for iOS navigator.standalone', () => {
    mm(false); Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    expect(isStandalone()).toBe(true);
  });
  it('is false in a normal tab', () => { mm(false); expect(isStandalone()).toBe(false); });
});

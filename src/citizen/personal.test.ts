// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPersonal, fitWithin, loadPersonal, savePersonal, toPhotoDataUrl, PHOTO_MAX } from './personal';

const ADDR = '5F3ydAf91e1kcSW5NWXgBamHowmJbjSz8b1Gvd41MyzLCNpd';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('personal fields', () => {
  it('saves, loads and clears per account, on this device only', () => {
    expect(loadPersonal(ADDR)).toEqual({ given: '', surname: '', photo: null });
    expect(savePersonal(ADDR, { given: 'Rêber', surname: 'Çiyayî', photo: 'data:image/jpeg;base64,AAAA' })).toBe(true);
    expect(loadPersonal(ADDR)).toEqual({ given: 'Rêber', surname: 'Çiyayî', photo: 'data:image/jpeg;base64,AAAA' });
    expect(loadPersonal('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY').given).toBe('');
    clearPersonal(ADDR);
    expect(loadPersonal(ADDR)).toEqual({ given: '', surname: '', photo: null });
  });
  it('a photo that is not a JPEG/PNG data URL is never loaded', () => {
    localStorage.setItem(`pezkuwi-explorer:citizen:${ADDR}`, JSON.stringify({ given: 'A', surname: 'B', photo: 'javascript:alert(1)' }));
    expect(loadPersonal(ADDR).photo).toBeNull();
    localStorage.setItem(`pezkuwi-explorer:citizen:${ADDR}`, '{not json');
    expect(loadPersonal(ADDR)).toEqual({ given: '', surname: '', photo: null });
  });
  it('blocked storage degrades: save reports false, load gives empty fields, nothing throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(savePersonal(ADDR, { given: 'A', surname: 'B', photo: null })).toBe(false);
    expect(loadPersonal(ADDR)).toEqual({ given: '', surname: '', photo: null });
    expect(() => clearPersonal(ADDR)).not.toThrow();
  });
});

describe('photo', () => {
  it('fits a large image within the limit, keeping its shape, and never enlarges', () => {
    expect(fitWithin(4000, 3000, PHOTO_MAX)).toEqual({ width: 320, height: 240 });
    expect(fitWithin(1000, 2000, PHOTO_MAX)).toEqual({ width: 160, height: 320 });
    expect(fitWithin(200, 100, PHOTO_MAX)).toEqual({ width: 200, height: 100 });
  });
  it('downscales an oversized image to a JPEG of at most 320px', async () => {
    const drawn: number[][] = [];
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (_i: unknown, ...a: number[]) => drawn.push(a) }), toDataURL: (t: string) => `data:${t};base64,QUJD` };
    const url = await toPhotoDataUrl(new File(['x'], 'p.png', { type: 'image/png' }), {
      decode: async () => ({ width: 4000, height: 3000, close() {} }), canvas: () => canvas as never,
    });
    expect(url).toBe('data:image/jpeg;base64,QUJD');
    expect([canvas.width, canvas.height]).toEqual([320, 240]);
    expect(drawn[0]).toEqual([0, 0, 320, 240]);
  });
  it('rejects a file that is not an image, or that does not decode', async () => {
    const deps = { decode: async () => { throw new Error('bad'); }, canvas: () => { throw new Error('unused'); } };
    await expect(toPhotoDataUrl(new File(['x'], 'a.txt', { type: 'text/plain' }), deps as never)).rejects.toThrow(/not an image/);
    await expect(toPhotoDataUrl(new File(['x'], 'a.png', { type: 'image/png' }), deps as never)).rejects.toThrow(/not an image/);
  });
});

import { storage } from '../lib/storage';

// The photo and name a person adds to their own card. They stay in this browser only (the storage wrapper,
// keyed by account) and are never sent anywhere.
export type Personal = { given: string; surname: string; photo: string | null };
const EMPTY: Personal = { given: '', surname: '', photo: null };
const key = (address: string) => `citizen:${address}`;
// Only a JPEG or PNG data URL is ever put in an <img>: anything else in storage is ignored.
const PHOTO_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export function loadPersonal(address: string): Personal {
  try {
    const raw = storage.get(key(address));
    if (!raw) return { ...EMPTY };
    const o = JSON.parse(raw) as Partial<Record<keyof Personal, unknown>>;
    return {
      given: typeof o.given === 'string' ? o.given.slice(0, 60) : '',
      surname: typeof o.surname === 'string' ? o.surname.slice(0, 60) : '',
      photo: typeof o.photo === 'string' && PHOTO_RE.test(o.photo) ? o.photo : null,
    };
  } catch { return { ...EMPTY }; }
}

// false when this browser would not store it (private mode, blocked storage, full): the caller can say so.
export const savePersonal = (address: string, p: Personal): boolean => storage.set(key(address), JSON.stringify(p));
export const clearPersonal = (address: string): void => storage.remove(key(address));

export const PHOTO_MAX = 320;
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

type Bitmap = { width: number; height: number; close?(): void };
type Canvas = { width: number; height: number; getContext(t: '2d'): { drawImage(i: Bitmap, x: number, y: number, w: number, h: number): void } | null; toDataURL(type: string, q?: number): string };
const browser = {
  decode: (f: File): Promise<Bitmap> => createImageBitmap(f),
  canvas: (): Canvas => document.createElement('canvas') as unknown as Canvas,
};

export class NotAnImageError extends Error { constructor() { super('not an image'); } }

// A picked file becomes a JPEG data URL no larger than PHOTO_MAX on its long side. Anything that is not an
// image, or does not decode as one, is rejected.
export async function toPhotoDataUrl(file: File, deps: { decode(f: File): Promise<Bitmap>; canvas(): Canvas } = browser): Promise<string> {
  if (!file.type.startsWith('image/')) throw new NotAnImageError();
  let img: Bitmap;
  try { img = await deps.decode(file); } catch { throw new NotAnImageError(); }
  const { width, height } = fitWithin(img.width, img.height, PHOTO_MAX);
  const c = deps.canvas();
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new NotAnImageError();
  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();
  const url = c.toDataURL('image/jpeg', 0.85);
  if (!url.startsWith('data:image/jpeg')) throw new NotAnImageError();
  return url;
}

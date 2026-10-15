// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { qrModules } from './qr';

const ADDR = '5F3ydAf91e1kcSW5NWXgBamHowmJbjSz8b1Gvd41MyzLCNpd';

describe('qrModules', () => {
  it('encodes the address locally, deterministically, with the three finder squares', () => {
    const q = qrModules(ADDR);
    expect(qrModules(ADDR)).toEqual(q);
    expect(q.size).toBeGreaterThanOrEqual(21);
    const dark = (r: number, c: number) => q.path.includes(`M${c} ${r}h1v1h-1z`);
    for (const [r, c] of [[0, 0], [0, q.size - 7], [q.size - 7, 0]]) {
      expect(dark(r, c)).toBe(true);
      expect(dark(r + 1, c + 1)).toBe(false);
      expect(dark(r + 3, c + 3)).toBe(true);
    }
  });
});

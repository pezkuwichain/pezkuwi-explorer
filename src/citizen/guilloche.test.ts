// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rose, wave } from './guilloche';

describe('guilloche', () => {
  it('rose is deterministic and starts where the curve starts', () => {
    const a = rose(420, 150, 120, 37, 70, 1.25, 37);
    expect(rose(420, 150, 120, 37, 70, 1.25, 37)).toBe(a);
    // t = 0: x = (R - r) + d = 153, scaled by 1.25 from cx; y = cy.
    expect(a.startsWith('M611.3 150.0L')).toBe(true);
    expect(a.split('L')).toHaveLength(1401);
  });
  it('wave is deterministic and spans the card width in 4-unit steps', () => {
    const w = wave(250, 9, 140, 0);
    expect(wave(250, 9, 140, 0)).toBe(w);
    const pts = w.slice(1).split('L');
    expect(pts).toHaveLength(136);
    expect(pts[0]).toBe('0 250.0');
    expect(pts.at(-1)!.startsWith('540 ')).toBe(true);
  });
});

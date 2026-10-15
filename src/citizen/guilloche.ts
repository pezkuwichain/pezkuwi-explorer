// Security-print line work for the citizen card, on the card's 540×340 drawing grid. Pure and deterministic:
// the same arguments always give the same SVG path.

// A hypotrochoid ("rose"): R/r/d shape it, sx stretches it sideways, turns closes it.
export function rose(cx: number, cy: number, R: number, r: number, d: number, sx: number, turns: number): string {
  const pts: string[] = [];
  const steps = 1400;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    pts.push(`${(cx + x * sx).toFixed(1)} ${(cy + y).toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}

// A wavy line across the card: a sine plus a faster, smaller one.
export function wave(y0: number, amp: number, period: number, phase: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= 540; x += 4) {
    const y = y0 + amp * Math.sin((x / period) * Math.PI * 2 + phase) + amp * 0.35 * Math.sin((x / (period * 0.37)) * Math.PI * 2);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}

// The card's patterns, computed once (module load); they never change.
export const PATTERNS = {
  roseA: rose(420, 150, 120, 37, 70, 1.25, 37),
  roseB: rose(420, 150, 96, 29, 52, 1.25, 29),
  roseC: rose(420, 150, 150, 43, 95, 1.25, 43),
  roseD: rose(110, 120, 110, 33, 64, 1.2, 33),
  waveA: `${wave(250, 9, 140, 0)} ${wave(258, 9, 140, 0.6)} ${wave(266, 9, 140, 1.2)}`,
  waveB: `${wave(274, 7, 110, 0.3)} ${wave(282, 7, 110, 0.9)}`,
  waveC: `${wave(60, 6, 170, 1.4)} ${wave(68, 6, 170, 2.0)}`,
  micro: 'DIJITAL KURDISTAN • WELATÎ • PEZKUWICHAIN • '.repeat(40),
};

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { NETWORK } from '../config/network';
import { TokenIcon } from './assetIcons';

describe('token art', () => {
  it('every token the explorer shows has the wallet art, served from the site itself', () => {
    for (const symbol of [NETWORK.native.symbol, ...NETWORK.assets.map((a) => a.symbol)]) {
      const { container, unmount } = render(<TokenIcon symbol={symbol} />);
      const src = container.querySelector('img')?.getAttribute('src');
      expect(src, symbol).toBe(`/tokens/${symbol}.svg`);
      const svg = readFileSync(`public${src}`, 'utf8');
      // The wallet's files: an SVG with no remote reference (the CSP allows only same-origin and data: images).
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/href="https?:/);
      unmount();
    }
  });

  it('keeps no token art the wallet does not show', () => {
    for (const gone of ['HEZ.png', 'PEZ.png', 'wUSDT.svg']) expect(existsSync(`public/tokens/${gone}`), gone).toBe(false);
  });
});

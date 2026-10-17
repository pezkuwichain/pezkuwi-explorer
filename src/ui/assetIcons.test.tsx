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
      // USDT is the wallet's Pezkuwi-badged PNG (wUSDT.png); HEZ and PEZ are its SVGs.
      expect(src, symbol).toBe(symbol === 'USDT' ? '/tokens/USDT.png' : `/tokens/${symbol}.svg`);
      const file = readFileSync(`public${src}`);
      if (src!.endsWith('.svg')) {
        const svg = file.toString('utf8');
        // An SVG with no remote reference (the CSP allows only same-origin and data: images).
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).not.toMatch(/href="https?:/);
      } else {
        expect(file.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      }
      unmount();
    }
  });

  it('keeps no token art the wallet does not show', () => {
    for (const gone of ['HEZ.png', 'PEZ.png', 'wUSDT.svg', 'USDT.svg']) expect(existsSync(`public/tokens/${gone}`), gone).toBe(false);
  });
});

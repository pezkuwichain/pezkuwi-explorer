import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The tab bar's space below the tabs is the device's bottom inset, or 8px where there is none, never a fixed
// amount added to it: in a wallet's DApp browser (inset 0, the wallet's toolbar right below the page) a fixed
// allowance shows as an empty band above that toolbar.
describe('tab bar bottom space', () => {
  const rule = (css: string, sel: string) => {
    const at = css.search(new RegExp(`^${sel.replace('.', '\\.')} \\{`, 'm'));
    expect(at).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };
  const layout = readFileSync('src/ui/layout.css', 'utf8');

  it('pads the bar by the inset alone, with an 8px floor', () => {
    const bar = rule(layout, '.tabbar');
    expect(bar).toMatch(/padding: 8px 12px max\(8px, env\(safe-area-inset-bottom, 0px\)\);/);
    expect(bar).toMatch(/block-size: var\(--tabbar\);/);
  });

  it('sizes the bar and the page clearance from the same token, which holds no fixed allowance', () => {
    expect(readFileSync('src/ui/theme.css', 'utf8')).toMatch(/--tabbar: calc\(62px \+ max\(8px, env\(safe-area-inset-bottom, 0px\)\)\);/);
    expect(rule(layout, '.page')).toMatch(/padding-block-end: var\(--tabbar\);/);
    expect(layout).not.toMatch(/calc\(\s*\d+px \+ env\(safe-area-inset-bottom/);
  });
});

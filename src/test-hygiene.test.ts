// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The history gates (spec §9) are only worth something if they run: no test file may skip, focus or defer a test.

// Blank out comments and string literals so a mention in prose or data does not count; newlines are kept.
// '…' and "…" end at a newline (they cannot span lines), so an unbalanced quote cannot hide the rest of a file.
function codeOnly(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && (c === '`' || src[j] !== '\n')) j += src[j] === '\\' ? 2 : 1;
      out += c + src.slice(i + 1, j).replace(/[^\n]/g, ' ') + c;
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const banned = new RegExp(String.raw`\b(it|test|describe|suite)(\.concurrent)?\.(skip|only|todo|skipIf|runIf)\b|\bx(it|test|describe)\s*\(`);
const offends = (src: string) => banned.test(codeOnly(src));

describe('the skip/focus detector', () => {
  it.each([
    'suite.skip("x", () => {})', 'it.concurrent.skip("x", () => {})', 'test.concurrent.only("x", () => {})',
    'xtest("x", () => {})', 'xit("x", () => {})', 'xdescribe("x", () => {})', 'describe.skipIf(true)("x", () => {})',
    'it.todo("x")', 'test.skip("x", () => {})',
  ])('catches %s', (src) => expect(offends(src)).toBe(true));
  it.each([
    '// it.skip("x") would hide a gate', '/* describe.only("x") */', '/**\n * xit("x") in a doc comment\n */',
    'const s = "it.skip(";', "const u = 'https://example.invalid'; it('runs', () => {});", 'fixit(1)', 'it("x", () => {})',
  ])('ignores %s', (src) => expect(offends(src)).toBe(false));
});

// Every unit test file vitest can pick up (src/ and scripts/; e2e/ is Playwright's and has its own runner).
function testFiles(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (f === 'node_modules') continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(f)) out.push(p);
    }
  };
  for (const d of ['src', 'scripts']) walk(d);
  return out;
}

describe('suite integrity', () => {
  it('finds the test files, in src and scripts', () => {
    const files = testFiles();
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(join('src', 'test-hygiene.test.ts'));
    expect(files.some((f) => f.startsWith('scripts'))).toBe(true);
  });
  it('no test file skips, focuses or defers a test', () => {
    const bad = testFiles().filter((f) => offends(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});

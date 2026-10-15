// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, 'check-deps.mjs');
const run = (lock: unknown) => {
  const file = join(mkdtempSync(join(tmpdir(), 'check-deps-')), 'package-lock.json');
  writeFileSync(file, JSON.stringify(lock));
  return spawnSync(process.execPath, [script, file], { encoding: 'utf8' }).status;
};

describe('check-deps', () => {
  it('passes a clean lockfile', () => expect(run({ packages: { '': {}, 'node_modules/@pezkuwi/api': {} } })).toBe(0));
  it('fails on any @polkadot package', () => expect(run({ packages: { 'node_modules/x/node_modules/@polkadot/util': {} } })).toBe(1));
  it('fails closed when the lockfile has no packages object', () => {
    expect(run({ lockfileVersion: 1, dependencies: { '@polkadot/util': {} } })).not.toBe(0);
    expect(run({ packages: null })).not.toBe(0);
    expect(run({ packages: [] })).not.toBe(0);
  });
});

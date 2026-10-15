import { readFileSync } from 'node:fs';
// Optional argument: lockfile path (used to test the guard against fixtures).
const lock = JSON.parse(readFileSync(process.argv[2] ?? 'package-lock.json', 'utf8'));
// Fail closed: without a packages map (an old or unexpected lockfile format) the guard cannot see anything.
if (typeof lock.packages !== 'object' || lock.packages === null || Array.isArray(lock.packages)) {
  console.error('lockfile has no "packages" object; cannot check dependencies');
  process.exit(1);
}
const bad = Object.keys(lock.packages).filter((k) => k.includes('node_modules/@polkadot/'));
if (bad.length) { console.error('@polkadot/* found in lockfile:\n' + bad.join('\n')); process.exit(1); }
console.log('dependency guard ok');

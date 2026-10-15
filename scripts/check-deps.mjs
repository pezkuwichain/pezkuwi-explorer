import { readFileSync } from 'node:fs';
const lock = readFileSync('package-lock.json', 'utf8');
if (/"node_modules\/@polkadot\//.test(lock)) { console.error('@polkadot/* found in lockfile'); process.exit(1); }
console.log('dependency guard ok');

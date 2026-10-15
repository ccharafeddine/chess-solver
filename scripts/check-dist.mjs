// Fails when any file in dist/ is over the per-file limit of static hosts
// (Cloudflare Pages: 25 MiB). Run after `vite build --mode web`.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const LIMIT = 25 * 1024 * 1024;
const dir = process.argv[2] ?? 'dist';

function* walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

if (!existsSync(dir)) {
  console.error(`check-dist: ${dir} does not exist; build first.`);
  process.exit(1);
}
let total = 0;
let largest = { path: '', size: 0 };
const over = [];
for (const p of walk(dir)) {
  const { size } = statSync(p);
  total += size;
  if (size > largest.size) largest = { path: p, size };
  if (size > LIMIT) over.push(`${relative(dir, p)} (${(size / 1048576).toFixed(1)} MiB)`);
}
const mib = (n) => `${(n / 1048576).toFixed(1)} MiB`;
if (over.length) {
  console.error(`check-dist: over the 25 MiB per-file limit:\n  ${over.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-dist: ok. ${mib(total)} total, largest ${relative(dir, largest.path)} at ${mib(largest.size)}.`);

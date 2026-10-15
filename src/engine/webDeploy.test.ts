/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf-8');

describe('static web deploy', () => {
  it('public/_headers isolates every path (COOP/COEP) for the threaded engine', () => {
    const h = read('../../public/_headers');
    expect(h).toMatch(/^\/\*$/m);
    expect(h).toMatch(/^\s+Cross-Origin-Opener-Policy: same-origin$/m);
    expect(h).toMatch(/^\s+Cross-Origin-Embedder-Policy: require-corp$/m);
  });

  it('the web build checks that no file is over the 25 MiB host limit', () => {
    const pkg = JSON.parse(read('../../package.json'));
    expect(pkg.scripts['build:web']).toMatch(/vite build --mode web && node scripts\/check-dist\.mjs/);
    expect(read('../../scripts/check-dist.mjs')).toMatch(/25 \* 1024 \* 1024/);
  });
});

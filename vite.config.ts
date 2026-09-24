import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createReadStream, copyFileSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
) as { version: string }

// COOP/COEP enable SharedArrayBuffer for the multi-threaded Stockfish build.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

// The engine ships straight from the `stockfish` npm package instead of being
// committed to the repo: the large multi-threaded NNUE build (strongest
// flavor; needs cross-origin isolation, which both the dev server and the
// Electron shell provide). The worker loads `./stockfish.js`, which in turn
// fetches `./stockfish.wasm` and spawns its pthreads from the same script.
const ENGINE_DIR = fileURLToPath(new URL('./node_modules/stockfish/bin/', import.meta.url))
const ENGINE_FILES: Record<string, { source: string; type: string }> = {
  'stockfish.js': { source: 'stockfish-18.js', type: 'application/javascript' },
  'stockfish.wasm': { source: 'stockfish-18.wasm', type: 'application/wasm' },
}

function stockfishEngine(): Plugin {
  let outDir = 'dist'
  const serve: Plugin['configureServer'] = (server) => {
    server.middlewares.use((req, res, next) => {
      const name = (req.url ?? '').split(/[?#]/)[0].split('/').pop() ?? ''
      const file = ENGINE_FILES[name]
      if (!file) return next()
      const path = join(ENGINE_DIR, file.source)
      res.setHeader('Content-Type', file.type)
      res.setHeader('Content-Length', statSync(path).size)
      for (const [k, v] of Object.entries(crossOriginIsolationHeaders)) res.setHeader(k, v)
      createReadStream(path).pipe(res)
    })
  }
  return {
    name: 'stockfish-engine',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    configureServer: serve,
    configurePreviewServer: serve as Plugin['configurePreviewServer'],
    writeBundle() {
      for (const [name, file] of Object.entries(ENGINE_FILES)) {
        copyFileSync(join(ENGINE_DIR, file.source), join(outDir, name))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stockfishEngine()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

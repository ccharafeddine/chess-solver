import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createReadStream, copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENGINE_FILES, type EngineTarget } from './src/engine/engineFiles'
import { applySiteUrl } from './src/build/siteMeta'

// Absolute link-preview URLs only when SITE_URL is set at build time (see src/build/siteMeta.ts).
const siteUrl = { name: 'site-url', transformIndexHtml: (html: string) => applySiteUrl(html, process.env.SITE_URL) }

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
// committed to the repo. Which build depends on the target (desktop: the full
// multi-threaded NNUE build; web: the lite builds), listed in
// src/engine/engineFiles.ts. Threaded builds need cross-origin isolation,
// which the dev server, the Electron shell and public/_headers provide.
const ENGINE_DIR = fileURLToPath(new URL('./node_modules/stockfish/bin/', import.meta.url))
function stockfishEngine(target: EngineTarget): Plugin {
  const files = ENGINE_FILES[target]
  let outDir = 'dist'
  const serve: Plugin['configureServer'] = (server) => {
    server.middlewares.use((req, res, next) => {
      const name = (req.url ?? '').split(/[?#]/)[0].split('/').pop() ?? ''
      const file = files[name]
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
      for (const [name, file] of Object.entries(files)) {
        copyFileSync(join(ENGINE_DIR, file.source), join(outDir, name))
      }
      // The packaged app serves dist/. The stockfish npm package's own
      // Copying.txt is dropped by electron-builder's node_modules exclusion,
      // so put the GPL and the notices next to the engine here.
      const licensesDir = join(outDir, 'licenses')
      mkdirSync(licensesDir, { recursive: true })
      const root = fileURLToPath(new URL('./', import.meta.url))
      copyFileSync(join(root, 'LICENSE'), join(licensesDir, 'GPL-3.0.txt'))
      copyFileSync(join(root, 'THIRD_PARTY_NOTICES'), join(licensesDir, 'THIRD_PARTY_NOTICES.txt'))
      copyFileSync(join(ENGINE_DIR, '..', 'Copying.txt'), join(licensesDir, 'stockfish-Copying.txt'))
    },
  }
}

// `vite build --mode web` (npm run build:web) makes the static web build with
// the lite engine; every other mode is the desktop build with the full engine.
// See src/engine/engineFiles.ts.
export default defineConfig(({ mode }) => ({
  plugins: [siteUrl, react(), stockfishEngine(mode === 'web' ? 'web' : 'desktop')],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __WEB_BUILD__: JSON.stringify(mode === 'web'),
  },
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))

/**
 * Which Stockfish build ships where.
 *
 * - Desktop (Electron): the full multi-threaded NNUE build (~113 MB wasm).
 *   The app's own server sends COOP/COEP, so SharedArrayBuffer is there.
 * - Web (static hosting, `npm run build:web`): the multi-threaded "lite"
 *   build (~7 MB), plus the single-threaded lite build as a fallback for
 *   pages served without COOP/COEP (no SharedArrayBuffer). Static hosts such
 *   as Cloudflare Pages cap single files at 25 MiB, which the full build
 *   cannot meet.
 *
 * Each script loads the .wasm with its own base name, so `stockfish.js`
 * fetches `stockfish.wasm` and `stockfish-single.js` fetches
 * `stockfish-single.wasm`.
 */
export type EngineTarget = 'desktop' | 'web';

export interface EngineFile {
  /** File in node_modules/stockfish/bin/. */
  source: string;
  type: string;
}

const JS = 'application/javascript';
const WASM = 'application/wasm';

export const ENGINE_FILES: Record<EngineTarget, Record<string, EngineFile>> = {
  desktop: {
    'stockfish.js': { source: 'stockfish-18.js', type: JS },
    'stockfish.wasm': { source: 'stockfish-18.wasm', type: WASM },
  },
  web: {
    'stockfish.js': { source: 'stockfish-18-lite.js', type: JS },
    'stockfish.wasm': { source: 'stockfish-18-lite.wasm', type: WASM },
    'stockfish-single.js': { source: 'stockfish-18-lite-single.js', type: JS },
    'stockfish-single.wasm': { source: 'stockfish-18-lite-single.wasm', type: WASM },
  },
};

export interface EngineChoice {
  script: string;
  /** True for the single-threaded build: run it with one thread. */
  single: boolean;
}

/**
 * The worker script to start. Threaded builds need SharedArrayBuffer, which
 * browsers only expose on cross-origin-isolated pages. The web build falls
 * back to the single-threaded engine; the desktop app always isolates its
 * page, so it has no fallback. Returns null when nothing can run.
 */
export function chooseEngine(target: EngineTarget, sharedMemory: boolean): EngineChoice | null {
  if (sharedMemory) return { script: './stockfish.js', single: false };
  if (target === 'web') return { script: './stockfish-single.js', single: true };
  return null;
}

/** Whether this page can run the threaded engine. */
export function hasSharedMemory(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated !== false;
}

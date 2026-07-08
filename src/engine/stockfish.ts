import type { Square } from 'chess.js';

export interface AnalysisLine {
  move: string;
  from: Square;
  to: Square;
  promotion?: string;
  evaluation: number;
  mate: number | null;
  depth: number;
  pv: string;
}

export interface AnalysisMeta {
  depth: number;
  nps: number;
  threads: number;
}

export type AnalysisCallback = (lines: AnalysisLine[], meta: AnalysisMeta, isFinal: boolean) => void;

export interface AnalyzeOptions {
  multiPV?: number;
  movetimeMs?: number;
}

// MultiPV=1 lets Stockfish concentrate alpha-beta pruning on a single line,
// reaching ~30-50% deeper at the same movetime. Bump in the UI for review.
const DEFAULT_MULTIPV = 1;
const DEFAULT_MOVETIME_MS = 3000;
const HASH_MB = 512;
// The 100MB+ WASM binary can take a while to compile on first load.
const UCIOK_TIMEOUT_MS = 20000;
// How long `stop` may take to produce its bestmove before we assume the
// worker is wedged and rebuild it.
const STOP_TIMEOUT_MS = 3000;
// Extra headroom past `go movetime` before the search is considered stuck.
const GO_GRACE_MS = 4000;
// A stuck search is retried this many times on a fresh worker before the
// failure is surfaced to the caller.
const MAX_RETRIES = 1;

function pickThreadCount(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;
  if (!cores || cores < 2) return 1;
  // Leave one core for UI/main thread; clamp to a sane upper bound.
  return Math.min(Math.max(cores - 1, 1), 8);
}

interface SearchRequest {
  fen: string;
  callback: AnalysisCallback;
  multiPV: number;
  movetimeMs: number;
  id: number;
  retries: number;
  cancelled: boolean;
}

/**
 * Wraps the Stockfish WASM worker with a two-slot queue:
 *
 *   current — the search whose `go` is in flight (bestmove not yet received)
 *   pending — the latest requested search, started once `current` ends
 *
 * The only UCI invariant this relies on is "every `go` produces exactly one
 * `bestmove`". The previous implementation synchronized on `isready`/`readyok`,
 * but the multi-threaded build does not guarantee bestmove/readyok ordering,
 * which produced stray-bestmove races and dropped analyses. Watchdogs cover
 * the cases where the worker wedges and never answers; `pending` survives an
 * engine restart, so recovery is automatic instead of requiring the user to
 * hit refresh.
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private destroyed = false;
  private threads = 1;
  private analysisId = 0;
  // 0 = unknown; the first search always sends the MultiPV setoption.
  private currentMultiPV = 0;
  private restartPromise: Promise<void> | null = null;

  private current: SearchRequest | null = null;
  private pending: SearchRequest | null = null;
  private stopRequested = false;

  private lines = new Map<number, AnalysisLine>();
  private lastStreamDepth = 0;
  private latestNps = 0;
  private latestInfoDepth = 0;

  private goWatchdogId: ReturnType<typeof setTimeout> | undefined = undefined;
  private stopWatchdogId: ReturnType<typeof setTimeout> | undefined = undefined;

  async init(): Promise<void> {
    await this.ensureWorker();
    if (!this.ready) throw new Error('Stockfish engine failed to initialize');
  }

  analyze(fen: string, callback: AnalysisCallback, options: AnalyzeOptions = {}): void {
    if (this.destroyed) return;
    const multiPV = Math.max(1, options.multiPV ?? DEFAULT_MULTIPV);
    const movetimeMs = Math.max(100, options.movetimeMs ?? DEFAULT_MOVETIME_MS);
    // Replacing `pending` silently drops any not-yet-started request; the app
    // only ever cares about the latest position.
    this.pending = {
      fen,
      callback,
      multiPV,
      movetimeMs,
      id: ++this.analysisId,
      retries: 0,
      cancelled: false,
    };
    this.kick();
  }

  /** Cancel the in-flight search without starting a new one. */
  stop(): void {
    this.pending = null;
    if (this.current) {
      this.current.cancelled = true;
      this.requestStop();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.pending = null;
    if (this.worker) {
      try { this.send('quit'); } catch { /* ignore */ }
    }
    this.teardownWorker();
    this.lines.clear();
  }

  /** Advance the queue: start `pending` as soon as the engine is free. */
  private kick(): void {
    if (this.destroyed || !this.pending) return;
    if (!this.worker || !this.ready) {
      this.ensureWorker();
      return;
    }
    if (this.current) {
      this.requestStop();
      return;
    }
    this.startPending();
  }

  private requestStop(): void {
    if (!this.stopRequested) {
      this.stopRequested = true;
      this.send('stop');
    }
    // If the bestmove acknowledging the stop never arrives, the worker is
    // wedged — rebuild it. `pending` survives the restart and runs after.
    if (this.stopWatchdogId === undefined) {
      this.stopWatchdogId = setTimeout(() => {
        this.stopWatchdogId = undefined;
        console.warn('[Stockfish] stop produced no bestmove; restarting engine');
        this.current = null;
        this.restart();
      }, STOP_TIMEOUT_MS);
    }
  }

  private startPending(): void {
    const req = this.pending;
    if (!req) return;
    this.pending = null;
    this.current = req;
    this.stopRequested = false;
    this.clearWatchdogs();
    this.lines.clear();
    this.lastStreamDepth = 0;
    this.latestNps = 0;
    this.latestInfoDepth = 0;

    if (req.multiPV !== this.currentMultiPV) {
      this.send(`setoption name MultiPV value ${req.multiPV}`);
      this.currentMultiPV = req.multiPV;
    }
    this.send(`position fen ${req.fen}`);
    this.send(`go movetime ${req.movetimeMs}`);

    this.goWatchdogId = setTimeout(() => {
      this.goWatchdogId = undefined;
      this.onSearchStuck(req);
    }, req.movetimeMs + GO_GRACE_MS);
  }

  private onSearchStuck(req: SearchRequest): void {
    if (this.current !== req) return;
    console.warn('[Stockfish] search returned no bestmove in time; restarting engine');
    this.current = null;
    if (!this.pending && !req.cancelled) {
      if (req.retries < MAX_RETRIES) {
        req.retries += 1;
        this.pending = req; // auto-retry on the fresh worker
      } else {
        req.callback([], this.currentMeta(), true);
      }
    }
    this.restart();
  }

  private ensureWorker(): Promise<void> {
    if (this.restartPromise) return this.restartPromise;
    this.restartPromise = this.createWorker()
      .then(() => {
        this.kick();
      })
      .catch((err) => {
        if (!this.destroyed) {
          console.error('[Stockfish] engine worker failed to start:', err);
        }
        const req = this.pending;
        this.pending = null;
        req?.callback([], this.currentMeta(), true);
      })
      .finally(() => {
        this.restartPromise = null;
      });
    return this.restartPromise;
  }

  private restart(): void {
    if (this.destroyed) return;
    this.teardownWorker();
    this.ensureWorker();
  }

  private teardownWorker(): void {
    this.clearWatchdogs();
    if (this.worker) {
      try { this.worker.terminate(); } catch { /* ignore */ }
    }
    this.worker = null;
    this.ready = false;
    this.current = null;
    this.stopRequested = false;
    this.currentMultiPV = 0;
  }

  private createWorker(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker('./stockfish.js');
      } catch (err) {
        reject(err);
        return;
      }
      this.worker = worker;

      const timeoutId = setTimeout(() => {
        worker.removeEventListener('message', onReady);
        try { worker.terminate(); } catch { /* ignore */ }
        if (this.worker === worker) this.worker = null;
        reject(new Error('Engine did not answer uci in time'));
      }, UCIOK_TIMEOUT_MS);

      worker.onerror = (e) => {
        console.warn('[Stockfish] Worker error:', e.message);
        e.preventDefault();
      };

      const onReady = (e: MessageEvent) => {
        const msg: string = typeof e.data === 'string' ? e.data : '';
        if (!msg.includes('uciok')) return;
        clearTimeout(timeoutId);
        worker.removeEventListener('message', onReady);
        worker.addEventListener('message', this.onMessage);

        const threads = pickThreadCount();
        this.threads = threads;
        this.send(`setoption name Threads value ${threads}`);
        this.send(`setoption name Hash value ${HASH_MB}`);
        this.send('ucinewgame');

        this.ready = true;
        console.log(`[Stockfish] Engine ready (Threads=${threads}, Hash=${HASH_MB}MB)`);
        resolve();
      };

      worker.addEventListener('message', onReady);
      worker.postMessage('uci');
    });
  }

  private send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private onMessage = (e: MessageEvent): void => {
    const msg: string = typeof e.data === 'string' ? e.data : '';

    if (msg.startsWith('bestmove')) {
      const finished = this.current;
      this.current = null;
      this.stopRequested = false;
      this.clearWatchdogs();
      if (this.pending) {
        // This bestmove just acknowledged the search we cancelled; its
        // results are stale, so discard them and start the queued search.
        this.startPending();
        return;
      }
      if (finished && !finished.cancelled) {
        this.emitFinal(finished);
      }
      // A bestmove with no current search is a stray from a search we
      // already gave up on; ignore it.
      return;
    }

    if (msg.startsWith('info') && msg.includes(' pv ')) {
      // Ignore stale lines from a stopped search and lines that arrive while
      // a cancellation is in flight.
      if (!this.current || this.stopRequested) return;
      this.parseInfoLine(msg, this.current);
    }
  };

  private parseInfoLine(line: string, req: SearchRequest): void {
    const nps = this.extractInt(line, 'nps');
    if (nps !== null) this.latestNps = nps;

    const multipv = this.extractInt(line, 'multipv');
    const depth = this.extractInt(line, 'depth');
    if (multipv === null || depth === null) return;
    this.latestInfoDepth = depth;

    const scoreCp = this.extractInt(line, 'score cp');
    const scoreMate = this.extractInt(line, 'score mate');

    const pvIndex = line.indexOf(' pv ');
    if (pvIndex === -1) return;
    const pvString = line.slice(pvIndex + 4).trim();
    const firstMove = pvString.split(' ')[0];

    const from = firstMove.slice(0, 2) as Square;
    const to = firstMove.slice(2, 4) as Square;
    const promotion = firstMove.length > 4 ? firstMove.slice(4) : undefined;

    const analysisLine: AnalysisLine = {
      move: firstMove,
      from,
      to,
      ...(promotion ? { promotion } : {}),
      evaluation: scoreCp ?? 0,
      mate: scoreMate,
      depth,
      pv: pvString,
    };

    this.lines.set(multipv, analysisLine);

    // Stream intermediate results once we have all lines for a new depth
    if (depth > this.lastStreamDepth && this.lines.size >= req.multiPV) {
      const allSameDepth = Array.from(this.lines.values()).every(l => l.depth >= depth);
      if (allSameDepth) {
        this.lastStreamDepth = depth;
        req.callback(this.sortedLines(), this.currentMeta(), false);
      }
    }
  }

  private sortedLines(): AnalysisLine[] {
    return Array.from(this.lines.entries())
      .sort(([a], [b]) => a - b)
      .map(([, line]) => line);
  }

  private currentMeta(): AnalysisMeta {
    return {
      depth: this.latestInfoDepth,
      nps: this.latestNps,
      threads: this.threads,
    };
  }

  private extractInt(line: string, token: string): number | null {
    const pattern = new RegExp(`\\b${token}\\s+(-?\\d+)`);
    const match = line.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }

  private emitFinal(req: SearchRequest): void {
    const meta = this.currentMeta();
    req.callback(this.sortedLines(), meta, true);
  }

  private clearWatchdogs(): void {
    if (this.goWatchdogId !== undefined) {
      clearTimeout(this.goWatchdogId);
      this.goWatchdogId = undefined;
    }
    if (this.stopWatchdogId !== undefined) {
      clearTimeout(this.stopWatchdogId);
      this.stopWatchdogId = undefined;
    }
  }
}

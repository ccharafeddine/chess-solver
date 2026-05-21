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

export type AnalysisCallback = (lines: AnalysisLine[], isFinal: boolean) => void;

export interface AnalyzeOptions {
  multiPV?: number;
  movetimeMs?: number;
}

const DEFAULT_MULTIPV = 3;
const DEFAULT_MOVETIME_MS = 3000;
const HASH_MB = 256;

function pickThreadCount(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;
  if (!cores || cores < 2) return 1;
  // Leave one core for UI/main thread; clamp to a sane upper bound.
  return Math.min(Math.max(cores - 1, 1), 8);
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private lines = new Map<number, AnalysisLine>();
  private lastStreamDepth = 0;
  private callback: AnalysisCallback | null = null;
  private ready = false;
  private timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  private settleTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  private analysisId = 0;
  // 0 = unknown; first analyze() will always send the MultiPV setoption.
  private currentMultiPV = 0;
  private expectedLines = DEFAULT_MULTIPV;

  private pendingAnalysis: {
    fen: string;
    callback: AnalysisCallback;
    multiPV: number;
    movetimeMs: number;
    id: number;
  } | null = null;
  private settling = false;

  async init(): Promise<void> {
    return this.createWorker();
  }

  private createWorker(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker('./stockfish.js');
      } catch (err) {
        reject(err);
        return;
      }

      this.worker.onerror = (e) => {
        console.warn('[Stockfish] Worker error:', e.message);
        e.preventDefault();
      };

      const onReady = (e: MessageEvent) => {
        const msg: string = typeof e.data === 'string' ? e.data : '';
        if (msg.includes('uciok')) {
          this.worker!.removeEventListener('message', onReady);
          this.worker!.addEventListener('message', this.onMessage);

          // Persistent engine config — set once per worker lifetime.
          const threads = pickThreadCount();
          this.send(`setoption name Threads value ${threads}`);
          this.send(`setoption name Hash value ${HASH_MB}`);
          this.send('ucinewgame');

          this.ready = true;
          console.log(`[Stockfish] Engine ready (Threads=${threads}, Hash=${HASH_MB}MB)`);
          resolve();
        }
      };

      this.worker.addEventListener('message', onReady);
      this.worker.postMessage('uci');
    });
  }

  private async restart(): Promise<void> {
    console.log('[Stockfish] Restarting engine...');
    if (this.worker) {
      try { this.worker.terminate(); } catch { /* ignore */ }
    }
    this.worker = null;
    this.ready = false;
    this.settling = false;
    this.pendingAnalysis = null;
    this.currentMultiPV = 0;
    this.clearAllTimeouts();
    await this.createWorker();
  }

  analyze(fen: string, callback: AnalysisCallback, options: AnalyzeOptions = {}): void {
    const multiPV = Math.max(1, options.multiPV ?? DEFAULT_MULTIPV);
    const movetimeMs = Math.max(100, options.movetimeMs ?? DEFAULT_MOVETIME_MS);

    this.clearAllTimeouts();
    this.callback = null;

    if (!this.worker || !this.ready) {
      this.restart().then(() => {
        this.startAnalysis(fen, callback, multiPV, movetimeMs);
      }).catch(() => {
        callback([], true);
      });
      return;
    }

    const id = ++this.analysisId;
    this.pendingAnalysis = { fen, callback, multiPV, movetimeMs, id };

    if (!this.settling) {
      this.settling = true;
      this.send('stop');
      this.send('isready');
    }

    // Timeout for the settling phase — if readyok never arrives, restart.
    this.settleTimeoutId = setTimeout(() => {
      console.warn('[Stockfish] Settle timeout, restarting...');
      const pending = this.pendingAnalysis;
      this.pendingAnalysis = null;
      this.settling = false;
      if (pending) {
        pending.callback([], true);
      }
      this.restart();
    }, 3000);
  }

  private startAnalysis(
    fen: string,
    callback: AnalysisCallback,
    multiPV: number,
    movetimeMs: number
  ): void {
    const id = this.analysisId;
    this.callback = callback;
    this.lines.clear();
    this.lastStreamDepth = 0;
    this.expectedLines = multiPV;

    if (multiPV !== this.currentMultiPV) {
      this.send(`setoption name MultiPV value ${multiPV}`);
      this.currentMultiPV = multiPV;
    }
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetimeMs}`);

    // Safety timeout: give the engine its full budget plus headroom before assuming it's stuck.
    const watchdogMs = movetimeMs + 2500;
    this.timeoutId = setTimeout(() => {
      if (this.analysisId !== id) return;
      console.warn('[Stockfish] Analysis timeout, restarting...');
      const cb = this.callback;
      this.callback = null;
      if (cb) cb([], true);
      this.restart();
    }, watchdogMs);
  }

  stop(): void {
    this.clearAllTimeouts();
    if (this.worker && this.ready) {
      this.send('stop');
    }
  }

  destroy(): void {
    this.clearAllTimeouts();
    if (this.worker) {
      try { this.send('quit'); } catch { /* ignore */ }
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
      this.callback = null;
      this.settling = false;
      this.pendingAnalysis = null;
      this.lines.clear();
    }
  }

  private clearAllTimeouts(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.settleTimeoutId !== undefined) {
      clearTimeout(this.settleTimeoutId);
      this.settleTimeoutId = undefined;
    }
  }

  private send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private onMessage = (e: MessageEvent): void => {
    const msg: string = typeof e.data === 'string' ? e.data : '';

    if (msg.includes('readyok')) {
      if (this.settleTimeoutId !== undefined) {
        clearTimeout(this.settleTimeoutId);
        this.settleTimeoutId = undefined;
      }
      this.settling = false;
      if (this.pendingAnalysis) {
        const { fen, callback, multiPV, movetimeMs } = this.pendingAnalysis;
        this.pendingAnalysis = null;
        this.startAnalysis(fen, callback, multiPV, movetimeMs);
      }
      return;
    }

    if (this.settling) return;

    if (msg.startsWith('info') && msg.includes(' pv ')) {
      this.parseInfoLine(msg);
    } else if (msg.startsWith('bestmove')) {
      this.clearAllTimeouts();
      this.emitResult();
    }
  };

  private parseInfoLine(line: string): void {
    const multipv = this.extractInt(line, 'multipv');
    const depth = this.extractInt(line, 'depth');
    if (multipv === null || depth === null) return;

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
    if (depth > this.lastStreamDepth && this.lines.size >= this.expectedLines) {
      const allSameDepth = Array.from(this.lines.values()).every(l => l.depth >= depth);
      if (allSameDepth) {
        this.lastStreamDepth = depth;
        this.streamResult();
      }
    }
  }

  private streamResult(): void {
    if (!this.callback) return;
    const sorted = Array.from(this.lines.entries())
      .sort(([a], [b]) => a - b)
      .map(([, line]) => line);
    this.callback(sorted, false);
  }

  private extractInt(line: string, token: string): number | null {
    const pattern = new RegExp(`\\b${token}\\s+(-?\\d+)`);
    const match = line.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }

  private emitResult(): void {
    if (!this.callback) return;

    const sorted = Array.from(this.lines.entries())
      .sort(([a], [b]) => a - b)
      .map(([, line]) => line);

    const cb = this.callback;
    this.callback = null;
    cb(sorted, true);
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StockfishEngine, type AnalysisLine } from './stockfish';

/**
 * Mimics the command handling of the stockfish.js worker: `go` and
 * `setoption` are queued while a search is running, everything else
 * (including `stop`) executes immediately. A search reports one info line
 * and ends with `bestmove` after `movetime`, or shortly after `stop`.
 */
class FakeEngineWorker {
  static instances: FakeEngineWorker[] = [];
  onerror: ((e: unknown) => void) | null = null;
  received: string[] = [];
  private listeners = new Set<(e: MessageEvent) => void>();
  private queue: string[] = [];
  private searching = false;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private fen = '';

  constructor() {
    FakeEngineWorker.instances.push(this);
  }

  addEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners.add(fn);
  }

  removeEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners.delete(fn);
  }

  terminate() {
    clearTimeout(this.searchTimer);
  }

  postMessage(cmd: string) {
    this.received.push(cmd);
    if (cmd.startsWith('go') || cmd.startsWith('setoption')) {
      this.queue.push(cmd);
      this.drain();
    } else {
      this.exec(cmd);
    }
  }

  /** Simulate the engine being busy so the next `go` gets queued. */
  holdSearchFlag() {
    this.searching = true;
  }

  releaseSearchFlag() {
    this.searching = false;
    this.drain();
  }

  private emit(msg: string) {
    // Worker messages arrive asynchronously.
    setTimeout(() => this.listeners.forEach((fn) => fn({ data: msg } as MessageEvent)), 0);
  }

  private drain() {
    while (this.queue.length && !this.searching) this.exec(this.queue.shift()!);
  }

  private exec(cmd: string) {
    if (cmd === 'uci') this.emit('uciok');
    else if (cmd === 'isready') this.emit('readyok');
    else if (cmd.startsWith('position fen ')) this.fen = cmd.slice('position fen '.length);
    else if (cmd === 'stop') {
      if (this.searching && this.searchTimer !== undefined) this.finish(1);
    } else if (cmd.startsWith('go movetime ')) {
      const ms = parseInt(cmd.slice('go movetime '.length), 10);
      this.searching = true;
      const move = this.fen.includes(' w ') ? 'e2e4' : 'e7e5';
      this.emit(`info depth 12 multipv 1 score cp 30 nodes 1000 nps 500000 pv ${move}`);
      this.searchTimer = setTimeout(() => this.finish(0), ms);
    }
  }

  private finish(delay: number) {
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    const move = this.fen.includes(' w ') ? 'e2e4' : 'e7e5';
    setTimeout(() => {
      this.emit(`bestmove ${move}`);
      this.searching = false;
      this.drain();
    }, delay);
  }
}

const WHITE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('StockfishEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEngineWorker.instances = [];
    vi.stubGlobal('Worker', FakeEngineWorker);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function startEngine() {
    const engine = new StockfishEngine();
    const ready = engine.init();
    await vi.advanceTimersByTimeAsync(10);
    await ready;
    return engine;
  }

  it('configures threads and hash before reporting ready', async () => {
    const engine = await startEngine();
    const [worker] = FakeEngineWorker.instances;
    const readyAt = worker.received.indexOf('isready');
    expect(worker.received.slice(0, readyAt).some((c) => c.startsWith('setoption name Hash'))).toBe(true);
    expect(worker.received.slice(0, readyAt).some((c) => c.startsWith('setoption name Threads'))).toBe(true);
    engine.destroy();
  });

  it('switches to a new position promptly when stop lands before a queued go', async () => {
    const engine = await startEngine();
    const [worker] = FakeEngineWorker.instances;
    const results: { fen: string; lines: AnalysisLine[]; final: boolean }[] = [];

    // The worker still considers itself busy, so this `go` is queued and the
    // first `stop` (sent when the user moves) is a no-op.
    worker.holdSearchFlag();
    engine.analyze(WHITE, (lines, _m, final) => results.push({ fen: WHITE, lines, final }), { movetimeMs: 3000 });
    engine.analyze(BLACK, (lines, _m, final) => results.push({ fen: BLACK, lines, final }), { movetimeMs: 3000 });
    await vi.advanceTimersByTimeAsync(5);
    worker.releaseSearchFlag(); // the queued go for WHITE starts now

    // A repeated `stop` must cut the WHITE search short, well before its
    // 3s movetime, and without restarting the engine.
    await vi.advanceTimersByTimeAsync(300);
    const black = results.filter((r) => r.fen === BLACK && r.lines.length > 0);
    expect(black.length).toBeGreaterThan(0);
    expect(black[0].lines[0].move).toBe('e7e5');
    expect(results.some((r) => r.fen === WHITE)).toBe(false);
    expect(FakeEngineWorker.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(results.at(-1)).toMatchObject({ fen: BLACK, final: true });
    engine.destroy();
  });

  it('never restarts the engine across a burst of rapid position changes', async () => {
    const engine = await startEngine();
    let finals = 0;
    let lastFinal: AnalysisLine[] = [];
    for (let i = 0; i < 40; i++) {
      const fen = i % 2 ? BLACK : WHITE;
      engine.analyze(fen, (lines, _m, final) => {
        if (final) {
          finals += 1;
          lastFinal = lines;
        }
      }, { movetimeMs: 1000 });
      await vi.advanceTimersByTimeAsync(i % 5 === 0 ? 400 : 3);
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeEngineWorker.instances).toHaveLength(1);
    expect(finals).toBe(1); // only the latest position completes
    expect(lastFinal[0].move).toBe('e7e5');
    engine.destroy();
  });
});

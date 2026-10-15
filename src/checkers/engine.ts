import type { WorkerReply, WorkerRequest } from './checkers.worker';

/**
 * Talks to the checkers worker. Starting a new analysis ends the previous one
 * by replacing the worker, so a stale search can never report into a new position.
 */
export class CheckersEngine {
  private worker: Worker | null = null;
  private nextId = 1;

  analyse(req: Omit<WorkerRequest, 'id'>, onReply: (reply: WorkerReply) => void): void {
    this.stop();
    const worker = new Worker(new URL('./checkers.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    const id = this.nextId++;
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      if (this.worker !== worker || e.data.id !== id) return;
      onReply(e.data);
      if (e.data.type !== 'info') this.stop();
    };
    worker.onerror = () => {
      if (this.worker !== worker) return;
      onReply({ id, type: 'error', depth: 0, nodes: 0, elapsedMs: 0, lines: [], error: 'The checkers engine stopped unexpectedly. Click ↻ to try again.' });
      this.stop();
    };
    worker.postMessage({ ...req, id } satisfies WorkerRequest);
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

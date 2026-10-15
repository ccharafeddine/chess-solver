/// <reference lib="webworker" />
// Runs the checkers search off the main thread. One request at a time; the
// page starts a fresh worker to cancel a search in progress.
import { analyse, type SearchInfo } from './search';
import { parseFen } from './rules';

export interface WorkerRequest {
  id: number;
  fen: string;
  multiPV: number;
  movetimeMs: number;
  history: string[];
}
export interface WireLine {
  notation: string;
  from: number;
  path: number[];
  score: number;
  winIn: number | null;
  pv: string[];
}
export interface WorkerReply {
  id: number;
  type: 'info' | 'done' | 'error';
  depth: number;
  nodes: number;
  elapsedMs: number;
  lines: WireLine[];
  error?: string;
}

const wire = (id: number, type: WorkerReply['type'], info: SearchInfo): WorkerReply => ({
  id,
  type,
  depth: info.depth,
  nodes: info.nodes,
  elapsedMs: info.elapsedMs,
  lines: info.lines.map((l) => ({ notation: l.notation, from: l.move.from, path: l.move.path, score: l.score, winIn: l.winIn, pv: l.pv })),
});

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, fen, multiPV, movetimeMs, history } = e.data;
  const parsed = parseFen(fen);
  if (!parsed.ok) {
    self.postMessage({ id, type: 'error', depth: 0, nodes: 0, elapsedMs: 0, lines: [], error: parsed.error } satisfies WorkerReply);
    return;
  }
  const final = analyse(parsed.value, { multiPV, movetimeMs, history, onInfo: (info) => self.postMessage(wire(id, 'info', info)) });
  self.postMessage(wire(id, 'done', final));
};

/**
 * The checkers engine: negamax alpha-beta with iterative deepening, a
 * transposition table, killer/history move ordering and a capture
 * extension (captures are forced, so the search never stops in the middle
 * of an exchange). Scores are from the side to move's view, 100 = one man.
 */
import {
  applyMove, generateMoves, hasCapture, moveNotation, rowOf, colOf, moveTo,
  type Move, type Position,
} from './rules';

export const WIN = 100000;
const WIN_THRESHOLD = WIN - 1000;
const MAX_PLY = 96;

export interface RankedLine {
  move: Move;
  notation: string;
  score: number; // side to move's view
  /** Plies to a forced win (positive) or loss (negative), else null. */
  winIn: number | null;
  pv: string[];
}

export interface SearchInfo {
  depth: number;
  nodes: number;
  elapsedMs: number;
  lines: RankedLine[];
}

export interface SearchOptions {
  multiPV?: number;
  movetimeMs?: number;
  maxDepth?: number;
  /** Keys of positions earlier in the game, for repetition draws. */
  history?: string[];
  onInfo?: (info: SearchInfo) => void;
}

// ---------- hashing ----------
let seed = 0x9e3779b9;
function rand32(): number {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed;
}
const ZLO = new Uint32Array(32 * 5);
const ZHI = new Uint32Array(32 * 5);
for (let i = 0; i < ZLO.length; i++) { ZLO[i] = rand32(); ZHI[i] = rand32(); }
const SIDE_LO = rand32(), SIDE_HI = rand32();

function hashOf(p: Position): [number, number] {
  let lo = 0, hi = 0;
  for (let s = 0; s < 32; s++) {
    const v = p.board[s];
    if (v !== 0) { const i = s * 5 + v + 2; lo ^= ZLO[i]; hi ^= ZHI[i]; }
  }
  if (p.turn === -1) { lo ^= SIDE_LO; hi ^= SIDE_HI; }
  return [lo >>> 0, hi >>> 0];
}
export function positionKey(p: Position): string {
  const [lo, hi] = hashOf(p);
  return `${hi.toString(16)}:${lo.toString(16)}`;
}

// ---------- evaluation ----------
const MAN = 100, KING = 135;
// Centre squares are worth a little more for kings and men alike.
const CENTRE = new Int8Array(32);
for (let s = 0; s < 32; s++) {
  const r = rowOf(s), c = colOf(s);
  const d = Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
  CENTRE[s] = Math.round((3.5 - d) * 3);
}

/** Static score from Black's view. */
function evaluateBlack(b: Int8Array): number {
  let score = 0, bm = 0, wm = 0, bk = 0, wk = 0;
  for (let s = 0; s < 32; s++) {
    const v = b[s];
    if (v === 0) continue;
    const r = rowOf(s);
    if (v === 1) { bm++; score += MAN + r * 3 + CENTRE[s]; }
    else if (v === -1) { wm++; score -= MAN + (7 - r) * 3 + CENTRE[s]; }
    else if (v === 2) { bk++; score += KING + CENTRE[s] * 2; }
    else { wk++; score -= KING + CENTRE[s] * 2; }
  }
  // Back-rank guards (squares 1 and 3 for Black, 30 and 32 for White) keep the other side from crowning.
  if (wk === 0 && wm > 0) { if (b[1] === 1) score += 8; if (b[2] === 1) score += 8; }
  if (bk === 0 && bm > 0) { if (b[29] === -1) score -= 8; if (b[30] === -1) score -= 8; }
  // When ahead, trading down is good: scale the lead by how few pieces remain.
  const bTotal = bm + bk, wTotal = wm + wk;
  if (bTotal !== wTotal) {
    const lead = bTotal > wTotal ? 1 : -1;
    score += lead * (24 - (bTotal + wTotal)) * 4;
  }
  return score;
}
export function evaluate(p: Position): number {
  return evaluateBlack(p.board) * p.turn;
}

// ---------- transposition table ----------
const TT_BITS = 20;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const EXACT = 1, LOWER = 2, UPPER = 3;

class Searcher {
  ttKey = new Uint32Array(TT_SIZE);
  ttScore = new Int32Array(TT_SIZE);
  ttDepth = new Int8Array(TT_SIZE);
  ttFlag = new Uint8Array(TT_SIZE);
  ttMove = new Int8Array(TT_SIZE);
  history = new Int32Array(32 * 32);
  killers: Int32Array = new Int32Array(MAX_PLY * 2).fill(-1);
  nodes = 0;
  deadline = Infinity;
  stopped = false;
  path: string[] = [];
  gameHistory = new Set<string>();

  moveCode(m: Move): number { return m.from * 32 + moveTo(m); }

  order(moves: Move[], ttIndex: number, ply: number): Move[] {
    const scored = moves.map((m, i) => {
      let s = 0;
      if (i === ttIndex) s = 1e9;
      else if (m.captures.length) s = 1e8 + m.captures.length * 1000;
      else {
        const code = this.moveCode(m);
        if (this.killers[ply * 2] === code) s = 9e7;
        else if (this.killers[ply * 2 + 1] === code) s = 8e7;
        else s = this.history[code];
      }
      return { m, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.m);
  }

  search(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stopped = true;
    if (this.stopped) return 0;

    const [lo, hi] = hashOf(p);
    const key = `${hi}:${lo}`;
    if (ply > 0 && (this.path.includes(key) || this.gameHistory.has(key))) return 0;

    const moves = generateMoves(p);
    if (moves.length === 0) return -(WIN - ply);
    if (ply >= MAX_PLY) return evaluate(p);

    const capturing = moves[0].captures.length > 0;
    // Quiet leaf: stop here. A leaf with a capture keeps going, since the capture is forced.
    if (depth <= 0 && !capturing) return evaluate(p);

    const idx = lo & TT_MASK;
    let ttIndex = -1;
    if (this.ttKey[idx] === hi && this.ttFlag[idx] !== 0) {
      ttIndex = this.ttMove[idx];
      if (ply > 0 && this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s > WIN_THRESHOLD) s -= ply; else if (s < -WIN_THRESHOLD) s += ply;
        const f = this.ttFlag[idx];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }

    // A single legal move costs nothing to extend.
    const nextDepth = moves.length === 1 ? depth : depth - 1;
    const ordered = this.order(moves, ttIndex >= 0 && ttIndex < moves.length ? ttIndex : -1, ply);
    const alpha0 = alpha;
    let best = -Infinity, bestMove = ordered[0];
    this.path.push(key);
    for (let i = 0; i < ordered.length; i++) {
      const m = ordered[i];
      const child = applyMove(p, m);
      let s: number;
      if (i === 0) s = -this.search(child, nextDepth, -beta, -alpha, ply + 1);
      else {
        s = -this.search(child, nextDepth, -alpha - 1, -alpha, ply + 1);
        if (s > alpha && s < beta) s = -this.search(child, nextDepth, -beta, -alpha, ply + 1);
      }
      if (this.stopped) break;
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!m.captures.length) {
          const code = this.moveCode(m);
          this.history[code] += depth * depth;
          if (this.killers[ply * 2] !== code) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = code; }
        }
        break;
      }
    }
    this.path.pop();
    if (this.stopped) return 0;

    let stored = best;
    if (stored > WIN_THRESHOLD) stored += ply; else if (stored < -WIN_THRESHOLD) stored -= ply;
    this.ttKey[idx] = hi;
    this.ttScore[idx] = stored;
    this.ttDepth[idx] = Math.max(-1, Math.min(127, depth));
    this.ttFlag[idx] = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    this.ttMove[idx] = moves.indexOf(bestMove);
    return best;
  }

  pvFrom(p: Position, first: Move): string[] {
    const out = [moveNotation(first)];
    let pos = applyMove(p, first);
    const seen = new Set<string>();
    for (let i = 0; i < 16; i++) {
      const [lo, hi] = hashOf(pos);
      const key = `${hi}:${lo}`;
      if (seen.has(key)) break;
      seen.add(key);
      const idx = lo & TT_MASK;
      if (this.ttKey[idx] !== hi || this.ttFlag[idx] === 0) break;
      const moves = generateMoves(pos);
      const m = moves[this.ttMove[idx]];
      if (!m) break;
      out.push(moveNotation(m));
      pos = applyMove(pos, m);
    }
    return out;
  }
}

function winInOf(score: number): number | null {
  if (score > WIN_THRESHOLD) return WIN - score;
  if (score < -WIN_THRESHOLD) return -(WIN + score);
  return null;
}

/**
 * Ranks the legal moves of a position. Reports after every finished depth;
 * returns the deepest complete ranking.
 */
export function analyse(p: Position, opts: SearchOptions = {}): SearchInfo {
  const multiPV = Math.max(1, opts.multiPV ?? 1);
  const maxDepth = Math.min(opts.maxDepth ?? 64, 64);
  const start = Date.now();
  const s = new Searcher();
  s.deadline = start + (opts.movetimeMs ?? 2000);
  for (const k of opts.history ?? []) s.gameHistory.add(k.split(':').map((h) => parseInt(h, 16)).join(':'));

  const rootMoves = generateMoves(p);
  let result: SearchInfo = { depth: 0, nodes: 0, elapsedMs: 0, lines: [] };
  if (rootMoves.length === 0) return result;

  const [rlo, rhi] = hashOf(p);
  const rootKey = `${rhi}:${rlo}`;
  let order = rootMoves.slice();
  for (let depth = 1; depth <= maxDepth; depth++) {
    const scores: { m: Move; score: number; exact: boolean }[] = [];
    const k = Math.min(multiPV, order.length);
    s.path = [rootKey];
    for (const m of order) {
      // Exact scores for the top k; the rest only need to be shown to be worse.
      const exactSoFar = scores.filter((x) => x.exact).map((x) => x.score).sort((a, b) => b - a);
      const alpha = exactSoFar.length >= k ? exactSoFar[k - 1] : -Infinity;
      const next = rootMoves.length === 1 ? depth : depth - 1;
      const score = -s.search(applyMove(p, m), next, -Infinity, alpha === -Infinity ? Infinity : -alpha, 1);
      if (s.stopped) break;
      scores.push({ m, score, exact: alpha === -Infinity || score > alpha });
    }
    if (s.stopped && scores.length < order.length) {
      // A partial depth still helps if its best move beat the previous best.
      break;
    }
    scores.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || b.score - a.score);
    order = scores.map((x) => x.m);
    const lines = scores.filter((x) => x.exact).slice(0, k).map((x) => ({
      move: x.m,
      notation: moveNotation(x.m),
      score: x.score,
      winIn: winInOf(x.score),
      pv: s.pvFrom(p, x.m),
    }));
    result = { depth, nodes: s.nodes, elapsedMs: Date.now() - start, lines };
    opts.onInfo?.(result);
    if (Date.now() > s.deadline) break;
    // Every line is a proven result, or there is only one move: deeper search changes nothing.
    if (rootMoves.length === 1 && depth >= 4) break;
    if (lines.every((l) => l.winIn !== null) && lines.length === k && depth > 2 * Math.max(...lines.map((l) => Math.abs(l.winIn!)))) break;
  }
  result.elapsedMs = Date.now() - start;
  return result;
}

/** True when the side to move must capture (for plain-words hints in the UI). */
export const mustCapture = hasCapture;
